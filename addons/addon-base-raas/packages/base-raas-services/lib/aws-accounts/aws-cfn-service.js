/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');
const crypto = require('crypto');

const { allowIfActive, allowIfAdmin } = require('@aws-ee/base-services/lib/authorization/authorization-utils');
const { processInBatches, randomString } = require('@aws-ee/base-services/lib/helpers/utils');

// const { generateId } = require('../helpers/utils');

/**
 * This service is responsible for managing CFN stacks that provision AWS account permissions
 */

const settingKeys = {
  awsRegion: 'awsRegion',
  envBootstrapBucket: 'envBootstrapBucketName',
  apiHandlerRoleArn: 'apiHandlerArn',
  workflowLoopRunnerRoleArn: 'workflowRoleArn',
  swbMainAccount: 'mainAcct',
  stage: 'envName',
};

const getCreateStackUrl = (cfnTemplateInfo, createParams) => {
  // see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-console-create-stacks-quick-create-links.html
  const { name, region, signedUrl } = cfnTemplateInfo;
  const { apiHandlerRoleArn, workflowLoopRunnerRoleArn, mainAcct, externalId, namespace } = createParams;
  const url = [
    `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/create/review/`,
    `?templateURL=${encodeURIComponent(signedUrl)}`,
    `&stackName=${name}`,
    `&param_Namespace=${namespace}`,
    `&param_CentralAccountId=${mainAcct}`,
    `&param_ExternalId=${externalId}`,
    `&param_ApiHandlerArn=${apiHandlerRoleArn}`,
    `&param_WorkflowRoleArn=${workflowLoopRunnerRoleArn}`,
  ].join('');

  // This one takes us directly to the review stage but will require that we access the cloudformation console first
  // const url = [
  //   `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/create/review/`,
  //   `?templateURL=${encodeURIComponent(signedUrl)}`,
  //   `&stackName=${name}`,
  // ].join('');

  // This takes us to the create new page:
  // `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/new`,
  // Note that this doesn't populate parameters correctly

  return url;
};

const getUpdateStackUrl = cfnTemplateInfo => {
  const { stackId, region, signedUrl } = cfnTemplateInfo;

  if (_.isEmpty(stackId)) return undefined;

  const url = [
    `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/update/template`,
    `?stackId=${encodeURIComponent(stackId)}`,
    `&templateURL=${encodeURIComponent(signedUrl)}`,
  ].join('');

  return url;
};

const getCfnHomeUrl = cfnTemplateInfo => {
  const { region } = cfnTemplateInfo;

  return `https://console.aws.amazon.com/cloudformation/home?region=${region}`;
};

class AwsCfnService extends Service {
  constructor() {
    super();
    this.boom.extend(['notSupported', 400]);
    this.dependency([
      'aws',
      'jsonSchemaValidationService',
      'authorizationService',
      'auditWriterService',
      'cfnTemplateService',
      'awsAccountsService',
      's3Service',
    ]);
  }

  async init() {
    await super.init();
  }

  /**
   * Queries the stack at the data source AWS account and returns the stack template as a string.
   *
   * An exception is thrown if an error occurs while trying to describe the stack. This could happen if the stack
   * is not created yet or is not provisioned in the correct account and region or was provisioned but did not
   * use the correct stack name.
   * @private
   * @param requestContext
   * @param accountEntity
   */
  async getStackTemplate(requestContext, accountEntity) {
    await this.assertAuthorized(
      requestContext,
      { action: 'query-aws-cfn-stack', conditions: [allowIfActive, allowIfAdmin] },
      { accountEntity },
    );
    const region = this.settings.get(settingKeys.awsRegion);
    const { xAccEnvMgmtRoleArn, cfnStackName, externalId } = accountEntity;
    const cfnApi = await this.getCfnSdk(xAccEnvMgmtRoleArn, externalId, region);
    const params = { StackName: cfnStackName };
    const stacks = await cfnApi.describeStacks(params).promise();
    const stack = _.find(_.get(stacks, 'Stacks', []), item => item.StackName === cfnStackName);

    if (_.isEmpty(stack)) {
      throw this.boom.notFound(`Stack '${cfnStackName}' not found`, true);
    }

    const permissionsTemplateRaw = await cfnApi.getTemplate(params).promise();

    return permissionsTemplateRaw.TemplateBody;
  }

  // This will need to be wrapped into aws-accounts-service once edit functionality is merged
  async getAndUploadTemplateForAccount(requestContext, accountId) {
    await this.assertAuthorized(
      requestContext,
      { action: 'get-upload-cfn-template', conditions: [allowIfActive, allowIfAdmin] },
      { accountId },
    );
    const cfnTemplateInfo = {};
    const createParams = {};

    const awsAccountsService = await this.service('awsAccountsService');
    const cfnTemplateService = await this.service('cfnTemplateService');
    const s3Service = await this.service('s3Service');

    const account = await awsAccountsService.mustFind(requestContext, { id: accountId });
    cfnTemplateInfo.template = await cfnTemplateService.getTemplate('onboard-account');
    cfnTemplateInfo.region = this.settings.get(settingKeys.awsRegion);
    cfnTemplateInfo.name = account.cfnStackName || ['SWB-Onboard-', randomString(20)].join('');
    cfnTemplateInfo.accountId = account.accountId;
    cfnTemplateInfo.stackId = account.cfnStackId;

    createParams.mainAcct = this.settings.get(settingKeys.swbMainAccount);
    createParams.apiHandlerRoleArn = this.settings.get(settingKeys.apiHandlerRoleArn);
    createParams.workflowLoopRunnerRoleArn = this.settings.get(settingKeys.workflowLoopRunnerRoleArn);
    createParams.externalId = 'workbench';
    createParams.namespace = this.settings.get(settingKeys.stage);

    // The id of the template is actually the hash of the of the content of the template
    const hash = crypto.createHash('sha256');
    hash.update(cfnTemplateInfo.template);
    cfnTemplateInfo.id = hash.digest('hex');

    // Upload to S3
    const bucket = this.settings.get(settingKeys.envBootstrapBucket);
    const key = `aws-accounts/acct-${account.id}/cfn/region/${cfnTemplateInfo.region}/${cfnTemplateInfo.id}.yml`;
    await s3Service.api
      .putObject({
        Body: cfnTemplateInfo.template,
        Bucket: bucket,
        Key: key,
      })
      .promise();

    // Sign the url
    // expireSeconds: 604800 /* seven days */, if we need 7 days, we need to use a real IAM user credentials.
    const expireSeconds = 12 * 60 * 60; // 12 hours
    const request = { files: [{ key, bucket }], expireSeconds };
    const urls = await s3Service.sign(request);
    const signedUrl = urls[0].signedUrl;

    cfnTemplateInfo.urlExpiry = Date.now() + expireSeconds * 1000;
    cfnTemplateInfo.signedUrl = signedUrl;
    cfnTemplateInfo.createStackUrl = getCreateStackUrl(cfnTemplateInfo, createParams);
    cfnTemplateInfo.updateStackUrl = getUpdateStackUrl(cfnTemplateInfo);
    cfnTemplateInfo.cfnConsoleUrl = getCfnHomeUrl(cfnTemplateInfo);

    // If we are onboarding the account for the first time, we have to populate some parameters for checking permissions later
    if (account.cfnStackName !== cfnTemplateInfo.name || account.xAccEnvMgmtRoleArn === undefined) {
      const updatedAcct = {
        id: account.id,
        rev: account.rev,
        cfnStackName: cfnTemplateInfo.name, // If SWB didn't generate a cfn name, this will be account.cfnStackName
        externalId: 'workbench',
        xAccEnvMgmtRoleArn: [
          'arn:aws:iam::',
          account.accountId,
          ':role/',
          createParams.namespace,
          '-cross-account-role',
        ].join(''),
        permissionStatus: account.permissionStatus === 'NEEDSONBOARD' ? 'PENDING' : account.permissionStatus,
      };
      await awsAccountsService.update(requestContext, updatedAcct);
    }

    return cfnTemplateInfo;
  }

  async checkAccountPermissions(requestContext, accountId) {
    await this.assertAuthorized(
      requestContext,
      { action: 'check-aws-permissions', conditions: [allowIfActive, allowIfAdmin] },
      { accountId },
    );
    const awsAccountsService = await this.service('awsAccountsService');
    const accountEntity = await awsAccountsService.mustFind(requestContext, { id: accountId });

    const [cfnTemplateService] = await this.service(['cfnTemplateService']);
    const expectedTemplate = await cfnTemplateService.getTemplate('onboard-account');

    // whitespace and comments removed before comparison
    const curPermissions = await this.getStackTemplate(requestContext, accountEntity);
    const trimmedCurPermString = curPermissions.replace(/#.*/g, '').replace(/\s+/g, '');
    const trimmedExpPermString = expectedTemplate.replace(/#.*/g, '').replace(/\s+/g, '');

    // still hash values
    return trimmedExpPermString !== trimmedCurPermString ? 'NEEDSUPDATE' : 'CURRENT';
  }

  async batchCheckAccountPermissions(requestContext, batchSize = 5) {
    await this.assertAuthorized(
      requestContext,
      { action: 'check-aws-permissions-batch', conditions: [allowIfActive, allowIfAdmin] },
      {},
    );

    const awsAccountsService = await this.service('awsAccountsService');
    const accountsList = await awsAccountsService.list();
    const stackOutputs = ['externalId', 'vpcId', 'subnetId', 'encryptionKeyArn', 'cfnStackId', 'roleArn'];
    const newStatus = {};
    const errors = {};
    const idList = accountsList.forEach(account => account.accountId);
    let res;
    let errorMsg = '';

    const checkPermissions = async account => {
      errorMsg = '';
      if (
        account.cfnStackName === '' ||
        account.cfnStackName === undefined ||
        account.permissionStatus === 'NEEDSONBOARD' // We'll explicitly bring the account out of NEEDSONBOARD separately
      ) {
        res = 'NEEDSONBOARD';
        errorMsg = `Account ${account.accountId} needs to be onboarded.`;
      } else {
        try {
          res = await this.checkAccountPermissions(requestContext, account.id);
          if (
            _.some(stackOutputs, prop => {
              return _.isUndefined(account[prop]);
            })
          ) {
            await this.finishOnboardingAccount(requestContext, account.id);
          }
        } catch (e) {
          // If the account is pending we're expecting it to error until it completes successfully
          res = account.permissionStatus === 'PENDING' ? 'PENDING' : 'ERRORED';
          errorMsg = e.safe // if error is boom error then see if it is safe to propagate its message
            ? `Error checking permissions for account ${account.accountId}. ${e.message}`
            : `Error checking permissions for account ${account.accountId}`;
        }
      }

      if (errorMsg !== '') {
        this.log.error(errorMsg);
        errors[account.id] = errorMsg;
      }

      newStatus[account.id] = res;
      if (res !== account.permissionStatus) {
        const updatedAcct = {
          id: account.id,
          rev: account.rev,
          roleArn: account.roleArn,
          externalId: account.externalId,
          permissionStatus: res,
        };
        await awsAccountsService.update(requestContext, updatedAcct);
      }
    };

    // Check permissions in parallel in the specified batches
    await processInBatches(accountsList, batchSize, checkPermissions);
    await this.audit(requestContext, {
      action: 'check-aws-permissions-batch',
      body: {
        totalAccounts: _.size(accountsList),
        usersChecked: idList,
        errors,
      },
    });
    return { newStatus, errors };
  }

  // @private
  async getCfnSdk(xAccEnvMgmtRoleArn, externalId, region) {
    const aws = await this.service('aws');
    try {
      const cfnClient = await aws.getClientSdkForRole({
        roleArn: xAccEnvMgmtRoleArn,
        externalId,
        clientName: 'CloudFormation',
        options: { region },
      });
      return cfnClient;
    } catch (error) {
      throw this.boom.forbidden(`Could not assume a role to check the stack status`, true).cause(error);
    }
  }

  async finishOnboardingAccount(requestContext, accountId) {
    await this.assertAuthorized(
      requestContext,
      { action: 'check-aws-permissions', conditions: [allowIfActive, allowIfAdmin] },
      { accountId },
    );
    const awsAccountsService = await this.service('awsAccountsService');
    const accountEntity = await awsAccountsService.mustFind(requestContext, { id: accountId });

    const region = this.settings.get(settingKeys.awsRegion);
    const { xAccEnvMgmtRoleArn, cfnStackName, externalId } = accountEntity;
    const cfnApi = await this.getCfnSdk(xAccEnvMgmtRoleArn, externalId, region);
    const params = { StackName: cfnStackName };
    const stacks = await cfnApi.describeStacks(params).promise();
    const stack = _.find(_.get(stacks, 'Stacks', []), item => item.StackName === cfnStackName);

    if (_.isEmpty(stack)) {
      throw this.boom.notFound(`Stack '${cfnStackName}' not found`, true);
    }

    const fieldsToUpdate = {};
    const findOutputValue = prop => {
      const output = _.find(_.get(stack, 'Outputs', []), item => item.OutputKey === prop);
      return output.OutputValue;
    };

    fieldsToUpdate.cfnStackId = stack.StackId;
    fieldsToUpdate.externalId = accountEntity.externalId || 'workbench';
    fieldsToUpdate.vpcId = findOutputValue('VPC');
    fieldsToUpdate.subnetId = findOutputValue('VpcPublicSubnet1');
    fieldsToUpdate.encryptionKeyArn = findOutputValue('EncryptionKeyArn');
    fieldsToUpdate.roleArn = findOutputValue('CrossAccountEnvMgmtRoleArn');

    fieldsToUpdate.id = accountEntity.id;
    fieldsToUpdate.rev = accountEntity.rev;

    // This should be wrapped in a try block a level up anyway, but for some reason it doesn't catch this error
    try {
      await awsAccountsService.update(requestContext, fieldsToUpdate);
    } catch (e) {
      throw this.boom.badRequest(`Failed to pull outputs from stack.`, true).cause(e);
    }
  }

  async assertAuthorized(requestContext, { action, conditions }, ...args) {
    const authorizationService = await this.service('authorizationService');

    // The "authorizationService.assertAuthorized" below will evaluate permissions by calling the "conditions" functions first
    // It will then give a chance to all registered plugins (if any) to perform their authorization.
    // The plugins can even override the authorization decision returned by the conditions
    // See "authorizationService.authorize" method for more details
    await authorizationService.assertAuthorized(
      requestContext,
      { extensionPoint: 'aws-account-authz', action, conditions },
      ...args,
    );
  }

  async audit(requestContext, auditEvent) {
    const auditWriterService = await this.service('auditWriterService');
    // Calling "writeAndForget" instead of "write" to allow main call to continue without waiting for audit logging
    // and not fail main call if audit writing fails for some reason
    // If the main call also needs to fail in case writing to any audit destination fails then switch to "write" method as follows
    // return auditWriterService.write(requestContext, auditEvent);
    return auditWriterService.writeAndForget(requestContext, auditEvent);
  }
}

module.exports = AwsCfnService;

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

import _ from 'lodash';
import React from 'react';
import { action, decorate, observable, computed, runInAction } from 'mobx';
import { inject, observer } from 'mobx-react';
import { Button, Dimmer, Loader, Icon, Table } from 'semantic-ui-react';
// import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import validate from '@aws-ee/base-ui/dist/models/forms/Validate';

import { displayError, displaySuccess } from '@aws-ee/base-ui/dist/helpers/notification';
import { getUpdateAwsAccountFormFields } from '../../models/forms/UpdateAwsAccountForm';

// Some values will be pulled from the CFN, so the user shouldn't be updating them
const disabledProps = {
  roleArn: false,
  externalId: true,
  vpcId: true,
  subnetId: true,
  encryptionKeyArn: true,
  cfnStackName: false,
  description: false,
  name: false,
};

const rowKeyVal = {
  name: 'Name',
  description: 'Description',
  cfnStackName: 'CloudFormation Stack Name',
  roleArn: 'Role ARN',
  externalId: 'External ID',
  vpcId: 'VPC ID',
  subnetId: 'Subnet ID',
  encryptionKeyArn: 'Encryption Key ARN',
};

const valsToOmit = ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'budget'];

// expected props
// - account UUID
// - awsAccountsStore (via injection)
class AccountDetailTable extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.resetForm();
    });
    this.updateAwsAccountFormFields = getUpdateAwsAccountFormFields();
  }

  getAwsAccountsStore() {
    const store = this.props.awsAccountsStore;
    return store;
  }

  getCurrentAccountInfo() {
    const store = this.getAwsAccountsStore();
    const id = this.props.id;
    const curAccountInfo = store.getAwsAccount(id);
    return curAccountInfo;
  }

  get account() {
    const store = this.getAwsAccountsStore();
    const id = this.props.id;
    const curAccountInfo = store.getAwsAccount(id);
    return curAccountInfo;
  }

  enableEditMode = () => {
    this.editModeOn = true;
  };

  resetForm = () => {
    this.editModeOn = false;
    this.isProcessing = false;
    this.formInputs = {};
  };

  submitUpdate = async () => {
    runInAction(() => {
      this.isProcessing = true;
    });
    // Perform update

    try {
      const store = this.getAwsAccountsStore();
      const account = this.account;
      const id = this.props.id;

      const toUpdate = { ...this.formInputs, id: account.id, rev: account.rev };
      const updaterKeys = Object.keys(this.formInputs);
      if (updaterKeys.includes('cfnStackName') || updaterKeys.includes('roleArn')) {
        toUpdate.permissionStatus = 'PENDING';
        const newStatus = await store.checkAccountPermissionStatus(id);
        toUpdate.permissionStatus = newStatus.status;
      }

      // Attempt to validate on client side before making the API call
      const validationResult = await validate({ ...account, ...toUpdate }, this.updateAwsAccountFormFields);
      if (validationResult.fails()) {
        const errs = validationResult.errors.errors;
        const errArray = [];
        Object.keys(errs).forEach(key => {
          const errmessage = errs[key].join(' ').replace(key, rowKeyVal[key]);
          errArray.push(errmessage);
        });
        throw Error(errArray.join(' '));
      }
      await store.updateAwsAccount(id, _.omit(toUpdate, valsToOmit));

      displaySuccess('Update Succeeded!');
      runInAction(() => {
        this.resetForm();
      });
    } catch (error) {
      displayError('Update Failed', error);
      runInAction(() => {
        this.isProcessing = false;
        // this.resetForm();
      });
    }
  };

  render() {
    const account = this.account;

    return (
      <div className="mb2">
        <>
          <Dimmer.Dimmable dimmed={this.isProcessing}>
            <Dimmer active={this.isProcessing} inverted>
              <Loader size="big" />
            </Dimmer>
            <Table striped>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell width={2}>Attribute</Table.HeaderCell>
                  <Table.HeaderCell>
                    Value
                    {!this.editModeOn && (
                      <Icon name="pencil" className="ml1 cursor-pointer" color="grey" onClick={this.enableEditMode} />
                    )}
                  </Table.HeaderCell>
                </Table.Row>
              </Table.Header>

              <Table.Body>
                {Object.keys(rowKeyVal).map(entry => (
                  <Table.Row key={entry}>
                    <Table.Cell>{rowKeyVal[entry]}</Table.Cell>
                    <Table.Cell>{this.editModeOn ? this.renderRowInput(entry) : account[entry]}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>

            {this.editModeOn && (
              <>
                <Button
                  floated="right"
                  disabled={this.isProcessing}
                  onClick={this.submitUpdate}
                  size="mini"
                  color="blue"
                  icon
                >
                  Save Changes
                </Button>

                <Button floated="right" disabled={this.isProcessing} onClick={this.resetForm} size="mini">
                  Cancel
                </Button>
              </>
            )}
          </Dimmer.Dimmable>
        </>
      </div>
    );
  }

  renderRowInput(rowKey) {
    const account = this.account;
    const onChangeAction = action(event => {
      event.preventDefault();
      this.formInputs[rowKey] = event.target.value;
    });
    return (
      <div className="ui fluid input">
        <input
          type="text"
          defaultValue={account[rowKey]}
          onChange={onChangeAction}
          disabled={disabledProps[rowKey]}
          required={!disabledProps[rowKey]}
        />
      </div>
    );
  }
}

decorate(AccountDetailTable, {
  account: computed,
  editModeOn: observable,
  isProcessing: observable,
  enableEditMode: action,
  resetForm: action,
  submitUpdate: action,
});
export default inject('awsAccountsStore')(observer(AccountDetailTable));

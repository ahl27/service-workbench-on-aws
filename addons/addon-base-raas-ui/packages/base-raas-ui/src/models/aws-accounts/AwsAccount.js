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
import { types } from 'mobx-state-tree';
import Budget from './Budget';

const states = [
  {
    key: 'CURRENT',
    display: 'Up-to-Date',
    color: 'green',
    tip: 'IAM Role permissions are up-to-date.',
    spinner: false,
  },
  {
    key: 'NEEDSUPDATE',
    display: 'Needs Update',
    color: 'orange',
    tip: 'This account needs updated IAM Role permissions. Some functionalities may not work until update.',
    spinner: false,
  },
  {
    key: 'NEEDSONBOARD',
    display: 'Needs Onboarding',
    color: 'purple',
    tip: 'This account needs to be onboarded to SWB before it can be used.',
    spinner: false,
  },
  {
    key: 'NOSTACKNAME',
    display: 'Stack Name Missing',
    color: 'yellow',
    tip: "This account's Onboard CloudFormation stack ARN is missing. Please add it in in the 'Details' section.",
    spinner: false,
  },
  {
    key: 'ERROR',
    display: 'Error',
    color: 'red',
    tip: 'The account encountered an error while checking IAM role permissions.',
    spinner: false,
  },
  {
    key: 'PENDING',
    display: 'Pending',
    color: 'yellow',
    tip: 'The account is being modified. Please wait a moment.',
    spinner: true,
  },
  {
    key: 'UNKNOWN',
    display: 'Unknown',
    color: 'grey',
    tip: 'Something went wrong.',
    spinner: false,
  },
];
// ==================================================================
// AwsAccounts
// ==================================================================
const AwsAccount = types
  .model('AwsAccounts', {
    id: types.identifier,
    rev: types.maybe(types.number),
    name: '',
    description: '',
    accountId: '',
    externalId: '',
    permissionStatus: '',
    cfnStackName: '',
    roleArn: '',
    vpcId: '',
    subnetId: '',
    encryptionKeyArn: '',
    createdAt: '',
    createdBy: '',
    updatedAt: '',
    updatedBy: '',
    budget: types.optional(Budget, {}),
  })
  .actions(self => ({
    setAwsAccounts(rawAwsAccounts) {
      self.id = rawAwsAccounts.id;
      self.rev = rawAwsAccounts.rev || self.rev || 0;
      self.name = rawAwsAccounts.name || self.name || '';
      self.description = rawAwsAccounts.description || self.description || '';
      self.accountId = rawAwsAccounts.accountId || rawAwsAccounts.accountId;
      self.externalId = rawAwsAccounts.externalId || self.externalId;
      self.permissionStatus = rawAwsAccounts.permissionStatus || self.permissionStatus || 'ERROR';
      self.cfnStackName = rawAwsAccounts.cfnStackName || self.cfnStackName || '';
      self.roleArn = rawAwsAccounts.roleArn || self.roleArn;
      self.vpcId = rawAwsAccounts.vpcId || self.vpcId;
      self.subnetId = rawAwsAccounts.subnetId || self.subnetId;
      self.encryptionKeyArn = rawAwsAccounts.encryptionKeyArn || self.encryptionKeyArn;
      self.createdAt = rawAwsAccounts.createdAt || self.createdAt;
      self.updatedAt = rawAwsAccounts.updatedAt || self.updatedAt;
      self.createdBy = rawAwsAccounts.createdBy || self.createdBy;
      self.updatedBy = rawAwsAccounts.updatedBy || self.updatedBy;

      // Can't use || for needsPermissionUpdate because the value is a Boolean
      // we don't update the other fields because they are being populated by a separate store
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    // add view methods here
    get permissionStatusDetail() {
      // We need to clone the entry so that we don't impact the existing states object
      const entry = _.cloneDeep(_.find(states, ['key', self.permissionStatus]) || _.find(states, ['key', 'UNKNOWN']));

      return entry;
    },
  }));

// eslint-disable-next-line import/prefer-default-export
export { AwsAccount };

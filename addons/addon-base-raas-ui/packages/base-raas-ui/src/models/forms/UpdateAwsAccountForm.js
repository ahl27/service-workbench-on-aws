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

import { createForm } from '../../helpers/form';

const updateAwsAccountFormFields = {
  name: {
    label: 'Account Name',
    rules: 'required|string|between:1,100',
  },
  roleArn: {
    label: 'Role Arn',
    rules: 'required|string|between:10,300',
  },
  externalId: {
    label: 'External ID',
    rules: 'required|string|between:1,300',
  },
  description: {
    label: 'Description',
    rules: 'required|string',
  },
  cfnStackName: {
    label: 'CloudFormation Stack ARN',
    rules: 'required|string|between:1,300',
  },
  vpcId: {
    label: 'VPC ID',
    rules: 'required|string|min:12|max:21',
  },
  subnetId: {
    label: 'Subnet ID',
    rules: 'required|string|min:15|max:24',
  },
  encryptionKeyArn: {
    label: 'KMS Encryption Key ARN',
    rules: 'required|string|between:1,100',
  },
};

function getUpdateAwsAccountFormFields() {
  return updateAwsAccountFormFields;
}

function getUpdateAwsAccountForm() {
  return createForm(updateAwsAccountFormFields);
}

export { getUpdateAwsAccountFormFields, getUpdateAwsAccountForm };

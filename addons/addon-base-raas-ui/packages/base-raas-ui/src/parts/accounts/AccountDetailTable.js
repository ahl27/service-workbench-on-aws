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

import React from 'react';
import { action, decorate, observable, runInAction } from 'mobx';
import { inject, observer } from 'mobx-react';
import { Button, Dimmer, Loader, Icon, Table } from 'semantic-ui-react';

import { displayError, displaySuccess } from '@aws-ee/base-ui/dist/helpers/notification';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import _ from 'lodash';

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

const requiredProps = ['id', 'rev', 'roleArn', 'externalId'];

// expected props
// - account UUID
// - awsAccountsStore (via injection)
class AccountDetailTable extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.resetForm();
    });
  }

  componentDidMount() {
    const awsAccountsStore = this.props.awsAccountsStore;
    swallowError(awsAccountsStore.load());
    awsAccountsStore.startHeartbeat();
    // Without the heartbeat, the UI won't update correctly when an update is pushed
  }

  componentWillUnmount() {
    const awsAccountsStore = this.props.awsAccountsStore;
    awsAccountsStore.stopHeartbeat();
  }

  getAwsAccountsStore() {
    const store = this.props.awsAccountsStore;
    return store;
  }

  getCurrentAccountInfo() {
    const store = this.getAwsAccountsStore();
    swallowError(store.load());
    const id = this.props.id;
    const curAccountInfo = store.getAwsAccount(id);
    return curAccountInfo;
  }

  updateFormInputs() {
    const account = this.getCurrentAccountInfo();
    requiredProps.forEach(key => {
      this.formInputs[key] = account[key];
    });
  }

  enableEditMode = () => {
    // Show edit dropdowns via observable
    this.editModeOn = true;
  };

  resetForm = () => {
    this.editModeOn = false;
    this.isProcessing = false;
    this.formInputs = {};
    this.updateFormInputs();
  };

  checkRequiredValues = () => {
    Object.keys(disabledProps).forEach(key => {
      if (!disabledProps[key] && (_.isNil(this.formInputs[key]) || this.formInputs[key] === ''))
        throw Error(`The ${key} field cannot be blank`);
    });
  };

  submitUpdate = async () => {
    runInAction(() => {
      this.isProcessing = true;
    });
    // Perform update

    try {
      this.updateFormInputs(); // Sometimes there's some backend lag if the user tries to update back-to-back
      this.formInputs.permissionStatus = 'PENDING';
      this.checkRequiredValues();
      const store = this.getAwsAccountsStore();
      const id = this.props.id;
      await store.updateAwsAccount(id, this.formInputs);
      displaySuccess('Update Succeeded');
      runInAction(() => {
        this.resetForm();
      });
    } catch (error) {
      displayError('Update Failed', error);
      runInAction(() => {
        this.isProcessing = false;
      });
    }
  };

  render() {
    const account = this.getCurrentAccountInfo();

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
    const account = this.getCurrentAccountInfo();
    const onChangeAction = action(event => {
      event.preventDefault();
      this.formInputs[rowKey] = event.target.value === '' ? event.target.value : '';
      // empty string is autoconverted to NULL in the backend, which crashes things
      // a space is functionally the same without causing weird problems
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
  editModeOn: observable,
  isProcessing: observable,
  enableEditMode: action,
  resetForm: action,
  submitUpdate: action,
});
export default inject('awsAccountsStore')(observer(AccountDetailTable));

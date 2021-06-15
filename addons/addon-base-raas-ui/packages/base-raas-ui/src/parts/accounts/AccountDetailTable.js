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

// import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
// import Input from '@aws-ee/base-ui/dist/parts/helpers/fields/Input';
import { displayError, displaySuccess } from '@aws-ee/base-ui/dist/helpers/notification';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';

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
    const id = this.props.id;
    const curAccountInfo = store.getAwsAccount(id);
    return curAccountInfo;
  }

  updateAwsAccountInfo() {
    const store = this.getAwsAccountsStore();
    const id = this.props.id;
    const curAccountInfo = store.getAwsAccount(id);
    this.accountInfo = { ...curAccountInfo };
  }

  enableEditMode = () => {
    // Show edit dropdowns via observable
    this.editModeOn = true;
    const store = this.getAwsAccountsStore();
    store.stopHeartbeat();
  };

  resetForm = () => {
    this.editModeOn = false;
    this.isProcessing = false;
    const store = this.getAwsAccountsStore();
    store.startHeartbeat();
    this.updateAwsAccountInfo();
  };

  submitUpdate = async () => {
    runInAction(() => {
      this.isProcessing = true;
    });

    const localAccount = this.accountInfo;
    const remoteAccount = this.getCurrentAccountInfo();
    // Perform update

    try {
      const diffs = {};
      Object.keys(remoteAccount).forEach(key => {
        if (requiredProps.includes(key) || localAccount[key] !== remoteAccount[key]) {
          diffs[key] = localAccount[key] || '';
        }
      });
      diffs.permissionStatus = 'PENDING';
      const store = this.getAwsAccountsStore();
      const id = this.props.id;
      await store.updateAwsAccount(id, diffs);
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
    this.updateAwsAccountInfo();

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
                    <Table.Cell>{this.editModeOn ? this.renderRowInput(entry) : this.accountInfo[entry]}</Table.Cell>
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

  //   renderForm() {
  //     const account = this.getCurrentAccountInfo();

  //     return (
  //       <Form form={form} onCancel={this.handleCancel} onSuccess={this.handleFormSubmission}>
  //         {({ processing, onCancel }) => (
  //           <>
  //             <Input field={form.$('budgetLimit')} type="number" />
  //             <Input field={form.$('startDate')} type="date" />
  //             <Input field={form.$('endDate')} type="date" />
  //             <Input field={form.$('thresholds')} options={thresholdsOptions} multiple selection clearable fluid />
  //             <Input field={form.$('notificationEmail')} type="email" />
  //             <div className="mt3">
  //               <Button
  //                 floated="right"
  //                 primary
  //                 className="ml2"
  //                 type="submit"
  //                 content="Update Account"
  //                 disabled={this.isProcessing}
  //               />
  //               <Button floated="right" onClick={this.resetForm} content="Cancel" disabled={this.isProcessing} />
  //             </div>
  //           </>
  //         )}
  //       </Form>
  //     );
  //   }

  renderRowInput(rowKey) {
    const onChangeAction = action(event => {
      event.preventDefault();
      this.accountInfo[rowKey] = typeof event.target.value === 'string' ? event.target.value : '';
    });
    return (
      <div className="ui fluid input">
        <input
          type="text"
          defaultValue={this.accountInfo[rowKey]}
          placeholder={this.accountInfo[rowKey] || ''}
          onChange={onChangeAction}
          disabled={disabledProps[rowKey]}
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

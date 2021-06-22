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
import { decorate, action, computed, runInAction, observable } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Header, Segment, Accordion, Icon, Label, Button } from 'semantic-ui-react';
import c from 'classnames';

import { createLink } from '@aws-ee/base-ui/dist/helpers/routing';
import AccountDetailTable from './AccountDetailTable';

const statusDisplay = {
  CURRENT: { color: 'green', display: 'Up-to-Date' },
  NEEDSUPDATE: { color: 'orange', display: 'Needs Update' },
  NEEDSONBOARD: { color: 'purple', display: 'Needs Onboarding' },
  NOSTACKNAME: { color: 'yellow', display: 'Stack Name Missing' },
  ERROR: { color: 'red', display: 'Error' },
  PENDING: { color: 'yellow', display: 'Pending', spinner: true },
  UNKNOWN: { color: 'grey', display: 'Unknown' },
};

// expected props
// - id (via props)
// - account (via props)
// - permissionStatus (via props)
<<<<<<< HEAD
// - isSelectable (via props)
// - location (via props)
// - awsAccountsStore (via injection)
=======
// - isSelectable (via props) (currently unused)
>>>>>>> upstream/feat-update-user-permissions
class AccountCard extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.detailsExpanded = false;
      this.isSelected = false;
    });
  }

  get account() {
    return this.props.account;
  }

  get isSelectable() {
    return this.props.isSelectable;
  }

  get awsAccountsStore() {
    return this.props.awsAccountsStore;
  }

  get permissionStatus() {
    // Possible Values: CURRENT, NEEDSUPDATE, NEEDSONBOARD, ERRORED, NOSTACKNAME
    return this.props.permissionStatus;
  }

  goto(pathname) {
    const location = this.props.location;
    const link = createLink({ location, pathname });
    this.props.history.push(link);
  }

  handleDetailsExpanded = async () => {
    this.detailsExpanded = !this.detailsExpanded;
    const store = this.awsAccountsStore;
    console.log(this.detailsExpanded);
    if (this.detailsExpanded) {
      await store.load();
      store.stopHeartbeat();
    } else {
      store.startHeartbeat();
    }
  };

  handleSelected = () => {
    this.isSelected = !this.isSelected;
  };

  handleBudgetButton = () => {
    const awsAccountId = this.account.id;
    this.goto(`/aws-accounts/budget/${awsAccountId}`);
  };

  handleOnboardAccount = () => {
    return undefined;
  };

  handleUpdateAccountPerms = () => {
    return undefined;
  };

  handleInputCfnStackName = () => {
    return undefined;
  };

  render() {
    const isSelectable = this.isSelectable; // Internal and external guests can't select studies
    const account = this.account;
    const attrs = {};
    const onClickAttr = {};
    const permissionStatus = this.permissionStatus;

    if (this.isSelected) attrs.color = 'blue';
    if (isSelectable) onClickAttr.onClick = () => this.handleSelected();

    return (
      <Segment clearing padded raised className="mb3" {...attrs}>
        <div className="flex">
          <div className="flex-auto mb1">
            {this.renderStatus(permissionStatus)}
            {this.renderBudgetButton()}
            {this.renderHeader(account)}
            {this.renderDescription(account)}
            {(permissionStatus === 'NEEDSUPDATE' || permissionStatus === 'NEEDSONBOARD') &&
              this.renderUpdatePermsButton()}
            {this.renderDetails(account.id)}
          </div>
        </div>
      </Segment>
    );

    // Checkbox will be added to this segment when functionality for edit/delete users is added
    // <div className="mr2" {...onClickAttr}>
    //   {isSelectable && <Checkbox checked={this.isSelected} style={{ marginTop: '31px' }} />}
    // </div>
  }

  renderHeader(account) {
    const isSelectable = this.isSelectable;
    const onClickAttr = {};
    const idReadable = account.accountId.replace(/(.{4})(.{4})/g, '$1-$2-');
    if (isSelectable) onClickAttr.onClick = () => this.handleSelected();
    return (
      <div>
        <Header as="h3" color="blue" className={c('mt2', isSelectable ? 'cursor-pointer' : '')} {...onClickAttr}>
          {account.name}
          <Header.Subheader>
            <span className="pt1 fs-8 color-grey">AWS Account #{idReadable}</span>
          </Header.Subheader>
        </Header>
      </div>
    );
  }

  renderDescription(account) {
    return <div>{account.description}</div>;
  }

  renderStatus(status) {
    const state = statusDisplay[status] || statusDisplay.ERROR;
    return (
      <Label attached="top left" size="mini" color={state.color}>
        {state.spinner && <Icon name="spinner" loading />}
        {state.display}
      </Label>
    );
  }

  renderDetails(accountId) {
    const expanded = this.detailsExpanded;
    return (
      <Accordion className="mt2">
        <Accordion.Title active={expanded} index={0} onClick={this.handleDetailsExpanded}>
          <Icon name="dropdown" />
          <b>Details</b>
        </Accordion.Title>
        <Accordion.Content active={expanded}>{expanded && <AccountDetailTable id={accountId} />}</Accordion.Content>
      </Accordion>
    );
  }

  renderBudgetButton() {
    return (
      <Button floated="right" color="blue" onClick={this.handleBudgetButton}>
        Budget Detail
      </Button>
    );
  }

  renderUpdatePermsButton() {
    const permissionStatus = this.permissionStatus;
<<<<<<< HEAD
    const buttonArgs =
      permissionStatus === 'NEEDSUPDATE'
        ? { message: 'Update Permissions', color: 'orange', onClick: this.handleUpdateAccountPerms }
        : { message: 'Onboard Account', color: 'purple', onClick: this.handleOnboardAccount };
=======
    let buttonArgs;
    if (permissionStatus === 'NEEDSUPDATE')
      buttonArgs = { message: 'Update Permissions', color: 'orange', onClick: this.handleUpdateAccountPerms };
    else if (permissionStatus === 'NOSTACKNAME')
      buttonArgs = { message: 'Input Stack Name', color: 'yellow', onClick: this.handleInputCfnStackName };
    else buttonArgs = { message: 'Onboard Account', color: 'purple', onClick: this.handleOnboardAccount };
>>>>>>> upstream/feat-update-user-permissions
    // This button is only displayed if permissionStatus is NEEDSUPDATE, NEEDSONBOARD, or NOSTACKNAME
    return (
      <Button floated="right" color={buttonArgs.color} onClick={buttonArgs.onClick}>
        {buttonArgs.message}
      </Button>
    );
  }
}

decorate(AccountCard, {
  handleDetailsExpanded: action,
  handleSelected: action,
  handleBudgetButton: action,
  account: computed,
  detailsExpanded: observable,
  isSelectable: computed,
  isSelected: observable,
  permissionStatus: computed,
});

export default inject('awsAccountsStore')(withRouter(observer(AccountCard)));

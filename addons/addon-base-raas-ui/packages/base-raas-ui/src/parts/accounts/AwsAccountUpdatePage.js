import React from 'react';
import { decorate, computed, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';

import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreReady, isStoreLoading, isStoreError, stopHeartbeat } from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';

import AwsAccountUpdateContent from './AwsAccountUpdateContent';

// expected props
// - accountId (via prop)
// - awsAccountsStore (via injection)
class AwsAccountUpdatePage extends React.Component {
  componentDidMount() {
    this.awsAccountUUID = (this.props.match.params || {}).id;
    const awsAccountsStore = this.awsAccountsStore;
    if (!isStoreReady(awsAccountsStore)) {
      swallowError(awsAccountsStore.load());
    }
    const store = this.getAccountStore();
    if (!isStoreReady(store)) {
      swallowError(store.load());
    }
    console.log(store);
    store.startHeartbeat();
  }

  componentWillUnmount() {
    const store = this.getAccountStore();
    stopHeartbeat(store);
  }

  get account() {
    const store = this.awsAccountsStore;
    return store.getAwsAccount(this.awsAccountUUID);
  }

  // get awsAccountStore() {
  //   const accountsStore = this.awsAccountsStore();
  //   return accountsStore.getAwsAccountStore(this.awsAccountUUID);
  // }

  get awsAccountsStore() {
    return this.props.awsAccountsStore;
  }

  getAccountStore() {
    const accountsStore = this.awsAccountsStore;
    const accountStore = accountsStore.getAwsAccountStore(this.awsAccountUUID);

    return accountStore;
  }

  render() {
    const store = this.getAccountStore();
    let content = null;
    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder segmentCount={1} />;
    } else if (isStoreReady(store)) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return content;
  }

  renderMain() {
    const account = this.account;

    return (
      <div className="animated fadeIn mb3">
        <AwsAccountUpdateContent account={account} largeText={false} />
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(AwsAccountUpdatePage, {
  account: computed,
  awsAccountsStore: computed,
  // awsAccountStore: computed,
  getAccountStore: action,
});

export default inject('awsAccountsStore')(withRouter(observer(AwsAccountUpdatePage)));
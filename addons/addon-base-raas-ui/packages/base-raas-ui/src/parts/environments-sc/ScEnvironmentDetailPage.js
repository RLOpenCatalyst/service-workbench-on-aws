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
/* eslint-disable max-classes-per-file */
import React from 'react';
import _ from 'lodash';
import { decorate, computed, observable, runInAction } from 'mobx';
import { observer, inject, Observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import {
  Container,
  Breadcrumb,
  Divider,
  Grid,
  Segment,
  Table,
  Header,
  Message,
  Checkbox,
  Loader,
  Dimmer,
  Popup,
  Label,
  Icon,
  Tab,
} from 'semantic-ui-react';
import TimeAgo from 'react-timeago';

import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreLoading, isStoreError, isStoreReady } from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';

import By from '../helpers/By';
import ScEnvironmentButtons from './parts/ScEnvironmentButtons';
import ScEnvironmentCost from './parts/ScEnvironmentCost';
import ScEnvironmentCostTable from './parts/ScEnvironmentCostTable';

// This component is used with the TabPane to replace the default Segment wrapper since
// we don't want to display the border.
// eslint-disable-next-line react/prefer-stateless-function
class TabPaneWrapper extends React.Component {
  render() {
    return <>{this.props.children}</>;
  }
}

// expected props
// - scEnvironmentsStore (via injection)
// - userStore (via injection)
class ScEnvironmentDetailPage extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      // A flag to indicate if we are processing the call to trigger the terminate action
      this.processing = false;
    });
  }

  componentDidMount() {
    window.scrollTo(0, 0);
    const store = this.getEnvStore();
    if (store) {
      swallowError(store.load());
      store.startHeartbeat();
    }
  }

  componentWillUnmount() {
    const store = this.getEnvStore();
    if (store) {
      store.stopHeartbeat();
    }
  }

  get envsStore() {
    return this.props.scEnvironmentsStore;
  }

  get envTypesStore() {
    return this.props.envTypesStore;
  }

  get userStore() {
    return this.props.userStore.user;
  }

  get instanceId() {
    return (this.props.match.params || {}).instanceId;
  }

  getEnvStore() {
    const envsStore = this.envsStore;
    const envId = this.instanceId;
    return envsStore.getScEnvironmentStore(envId);
  }

  getEnv() {
    const store = this.getEnvStore();
    if (!store) return {};
    if (!isStoreReady(store)) return {};
    return store.scEnvironment;
  }

  render() {
    const store = this.getEnvStore();
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder />;
    } else if (isStoreReady(store)) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return (
      <Container className="mt3">
        {this.renderBreadcrumb()}
        {content}
      </Container>
    );
  }

  renderBreadcrumb() {
    const envId = this.instanceId;
    const goto = gotoFn(this);

    return (
      <Breadcrumb className="block mb3">
        <Breadcrumb.Section link onClick={() => goto('/workspaces')}>
          Research Workspaces
        </Breadcrumb.Section>
        <Breadcrumb.Divider icon="right angle" />
        <Breadcrumb.Section active>Workspace # {envId}</Breadcrumb.Section>
      </Breadcrumb>
    );
  }

  renderMain() {
    const env = this.getEnv();

    return (
      <>
        {this.renderTitle(env)}
        {this.renderError(env)}
        <Divider className="mt1 mb1" />
        {this.renderButtons(env)}
        <Divider className="mt1" />
        {env.description || 'Not description for this workspace was provided.'}
        <Grid columns={2} stackable className="mt2">
          <Grid.Row stretched>
            <Grid.Column width={12}>{this.renderDetailTable(env)}</Grid.Column>
            <Grid.Column width={4}>
              <Segment className="flex items-center">
                <div className="w-100 overflow-hidden">
                  <ScEnvironmentCost envId={env.id} />
                </div>
              </Segment>
            </Grid.Column>
          </Grid.Row>
        </Grid>
        {this.renderTabs(env)}
      </>
    );
  }

  renderDetailTable(env) {
    const studyIds = _.get(env, 'studyIds', []);
    const studyCount = _.size(studyIds);
    const renderRow = (key, value) => (
      <Table.Row>
        <Table.Cell width={5}>{key}</Table.Cell>
        <Table.Cell width={11} className="breakout">
          {value}
        </Table.Cell>
      </Table.Row>
    );
    const isAdmin = this.userStore.isAdmin;
    const envType = this.envTypesStore.getEnvType(env.envTypeId);

    return (
      <Table definition>
        <Table.Body>
          {isAdmin && renderRow('Termination Lock', this.renderTerminationLock(env))}
          {renderRow('Status', this.renderStatus(env))}
          {renderRow('Owner', <By uid={env.createdBy} skipPrefix />)}
          {renderRow('Studies', studyCount === 0 ? 'No studies linked to this workspace' : studyIds.join(', '))}
          {renderRow('Project', _.isEmpty(env.projectId) ? 'N/A' : env.projectId)}
          {renderRow(
            'Workspace Type',
            envType?.name || (
              <>
                {env.envTypeId}
                <Popup
                  trigger={<Icon color="red" className="ml1" name="question circle outline" />}
                  content="Workspace type is no longer approved or has been deleted."
                  size="mini"
                />
              </>
            ),
          )}
        </Table.Body>
      </Table>
    );
  }

  renderButtons(env) {
    return <ScEnvironmentButtons scEnvironment={env} />;
  }

  renderTitle(env) {
    return (
      <Header as="h3" className="mt1">
        <Icon name="server" className="align-top" />
        <Header.Content className="left-align">{env.name}</Header.Content>
        <Header.Subheader>
          <span className="fs-8 color-grey">
            Created <TimeAgo date={env.createdAt} className="mr2" /> <By uid={env.createdBy} className="mr2" />
          </span>
          <span className="fs-8 color-grey mr2"> {env.id}</span>
        </Header.Subheader>
      </Header>
    );
  }

  renderStatus(env) {
    const state = env.state;
    return (
      <div style={{ cursor: 'default' }}>
        <Popup
          trigger={
            <Label size="mini" color={state.color}>
              {state.spinner && <Icon name="spinner" loading />}
              {state.display}
            </Label>
          }
        >
          {state.tip}
        </Popup>
      </div>
    );
  }

  renderTerminationLock(env) {
    return (
      <>
        <Dimmer inverted active={this.processing}>
          <Loader inverted />
        </Dimmer>
        <Checkbox
          fitted
          checked={env.terminationLocked}
          toggle
          label={env.terminationLocked ? 'Locked' : 'Unlocked'}
          onClick={() => this.handleWorkspaceLockToggle(env)}
        />
      </>
    );
  }

  async handleWorkspaceLockToggle(env) {
    const store = this.envsStore;
    runInAction(() => {
      this.processing = true;
    });
    try {
      await store.toggleScEnvironmentLock(env.id);
    } catch (error) {
      displayError(error);
    } finally {
      runInAction(() => {
        this.processing = false;
      });
    }
  }

  renderError(env) {
    if (_.isEmpty(env.error)) return null;

    return (
      <Message negative>
        <p>{env.error}</p>
      </Message>
    );
  }

  renderTabs(env) {
    const panes = [
      {
        menuItem: 'Cost',
        render: () => (
          <Tab.Pane attached={false} key="cost" as={TabPaneWrapper}>
            <Observer>{() => <ScEnvironmentCostTable envId={env.id} />}</Observer>
          </Tab.Pane>
        ),
      },
      {
        menuItem: 'CloudFormation Output',
        render: () => (
          <Tab.Pane attached={false} key="cfn-outputs" as={TabPaneWrapper}>
            <Observer>{() => this.renderCfnOutput(env)}</Observer>
          </Tab.Pane>
        ),
      },
    ];

    return <Tab className="mt4" menu={{ secondary: true, pointing: true }} renderActiveOnly panes={panes} />;
  }

  renderCfnOutput(env) {
    const outputs = env.outputs;
    const isEmpty = _.isEmpty(outputs);
    const renderRow = (index, key, value, desc) => (
      <Table.Row key={index}>
        <Table.Cell width={5}>{key}</Table.Cell>
        <Table.Cell width={11} className="breakout">
          {value}
          <div className="fs-7">{desc}</div>
        </Table.Cell>
      </Table.Row>
    );

    return (
      <>
        {!isEmpty && (
          <Table definition className="mt3">
            <Table.Body>
              {_.map(outputs, (item, index) => renderRow(index, item.OutputKey, item.OutputValue, item.Description))}
            </Table.Body>
          </Table>
        )}
        {isEmpty && <Message className="mt3" content="None is available" />}
      </>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvironmentDetailPage, {
  instanceId: computed,
  envsStore: computed,
  envTypesStore: computed,
  userStore: computed,
  processing: observable,
});

export default inject(
  'userStore',
  'envTypesStore',
  'scEnvironmentsStore',
)(withRouter(observer(ScEnvironmentDetailPage)));

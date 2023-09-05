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

import logoImage from '@aws-ee/base-ui/images/login-image.gif';
import awsImage from '../../images/SWB.png';

/**
 * Registers base stores to the appContext object
 *
 * @param appContext An application context object
 */
// eslint-disable-next-line no-unused-vars
function registerAppContextItems(appContext) {
  appContext.assets.images.registerAws = awsImage;
  appContext.assets.images.registerLogo = logoImage;
}

const plugin = {
  registerAppContextItems,
};
export default plugin;

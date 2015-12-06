/// <reference path="../library/react.d.ts" />

import * as React from 'react';

var HelloMessage = React.createClass({
  render: function() {
    return <div>Hello {this.props.name}</div>;
  }
});

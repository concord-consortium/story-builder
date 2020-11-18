import React from 'react';
import ReactDOM from 'react-dom';
import StoryBuilderComponent from './pieces/story_builder_component';

it('renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<StoryBuilderComponent />, div);
  ReactDOM.unmountComponentAtNode(div);
});

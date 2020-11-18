import React, { Component } from 'react';
import '../story_builder.css';
import {HelpButton} from "./help_button";

import {StoryAreaComponent} from "./story_area_component"
import {StoryBuilder} from "../models/story_builder";

class StoryBuilderComponent extends Component<{}> {
  private storyBuilder:StoryBuilder = new StoryBuilder();

  public async UNSAFE_componentWillMount() {
    await this.storyBuilder.initialize();
  }

  public render() {
    return (
      <div className="SB SB-empty-back">
        <HelpButton/>
        <StoryAreaComponent  myStoryArea={this.storyBuilder.storyArea}/>
      </div>
    );
  }

}

export default StoryBuilderComponent;

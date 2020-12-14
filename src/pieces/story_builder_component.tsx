import React, { Component } from 'react';
import '../story_builder.css';
import {HelpButton} from "./help_button";

import {StoryAreaComponent} from "./story_area_component"
import {StoryBuilder} from "../models/story_builder";

class StoryBuilderComponent extends Component<{}> {
  private storyBuilder:StoryBuilder | undefined;

  public async UNSAFE_componentWillMount() {
    this.storyBuilder = new StoryBuilder();
    await this.storyBuilder.initialize();
  }

  public render() {
    if(!(this.storyBuilder && this.storyBuilder.storyArea))
      return '';
    else
      return (
        <div className="SB SB-empty-back">
          <HelpButton/>
          <StoryAreaComponent myStoryArea={this.storyBuilder.storyArea}/>
        </div>
      );
  }

}

export default StoryBuilderComponent;

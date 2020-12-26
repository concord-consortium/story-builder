import React, { Component } from 'react';
import '../story_builder.css';
import {HelpButton, LockButton} from "./help_and_lock_buttons";

import {StoryAreaComponent} from "./story_area_component"
import {StoryBuilder} from "../models/story_builder";

class StoryBuilderComponent extends Component<{},{locked:boolean}> {
  private storyBuilder:StoryBuilder | undefined;

  constructor(props:any) {
    super(props);
    this.state = {locked: false}
    this.toggleLock = this.toggleLock.bind( this);
  }

  public async UNSAFE_componentWillMount() {
    this.storyBuilder = new StoryBuilder();
    await this.storyBuilder.initialize();
  }

  componentDidMount() {
    if( this.storyBuilder)
      this.setState({locked: this.storyBuilder.storyArea.isLocked});
  }

  toggleLock() {
    if( this.storyBuilder) {
      let tLocked = !this.storyBuilder.storyArea.isLocked;
      this.storyBuilder.storyArea.isLocked = tLocked;
      this.setState({locked: tLocked});
    }
  }

  public render() {
    if(!(this.storyBuilder && this.storyBuilder.storyArea))
      return '';
    else
      return (
        <div className="SB SB-empty-back">
          <div className="SB-help-lock-buttons">
            <HelpButton/>
            <LockButton
              isLocked={this.storyBuilder.storyArea.isLocked}
              clickCallback={this.toggleLock}/>
          </div>
          <StoryAreaComponent myStoryArea={this.storyBuilder.storyArea}/>
        </div>
      );
  }

}

export default StoryBuilderComponent;

import React, { Component } from 'react';
import '../story_builder.css';
import {HelpButton, LockButton} from "./help_and_lock_buttons";

import {StoryAreaComponent} from "./story_area_component"
import {StoryBuilder} from "../models/story_builder";

class StoryBuilderComponent extends Component<{},{locked:boolean, count:number}> {
  private storyBuilder:StoryBuilder | undefined;

  constructor(props:any) {
    super(props);
    this.state = {locked: false, count: 0}
    this.toggleLock = this.toggleLock.bind( this);
    this.doForceUpdate = this.doForceUpdate.bind( this);
  }

  public async UNSAFE_componentWillMount() {
    this.storyBuilder = new StoryBuilder();
    await this.storyBuilder.initialize();
  }

  componentDidMount() {
    if( this.storyBuilder)
      this.setState({locked: this.storyBuilder.storyArea.isLocked, count: this.state.count});
  }

  doForceUpdate() {
    this.setState({count: this.state.count + 1, locked: this.state.locked});
  }

  toggleLock() {
    if( this.storyBuilder) {
      this.storyBuilder.storyArea.toggleLock();
      this.setState({locked: this.storyBuilder.storyArea.isLocked, count: this.state.count});
    }
  }

  public render() {
    let this_ = this;
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
          <StoryAreaComponent
            myStoryArea={this.storyBuilder.storyArea}
            forceUpdateCallback={this_.doForceUpdate}
          />
        </div>
      );
  }

}

export default StoryBuilderComponent;

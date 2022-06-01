import React, { Component } from 'react';
import '../story_builder.css';
import {HelpButton, AutoSaveButton} from "./help_and_auto_save_buttons";

import {StoryAreaComponent} from "./story_area_component"
import {StoryBuilder} from "../models/story_builder";

class StoryBuilderComponent extends Component<{},{isAutoSave:boolean, count:number}> {
  private storyBuilder:StoryBuilder | undefined;

  constructor(props:any) {
    super(props);
    this.state = {isAutoSave: false, count: 0}
    this.toggleAutoSave = this.toggleAutoSave.bind( this);
    this.doForceUpdate = this.doForceUpdate.bind( this);
  }

  public async UNSAFE_componentWillMount() {
    this.storyBuilder = new StoryBuilder();
    await this.storyBuilder.initialize();
  }

  componentDidMount() {
    if( this.storyBuilder)
      this.setState({isAutoSave: this.storyBuilder.storyArea.isAutoSave, count: this.state.count});
  }

  doForceUpdate() {
    this.setState({count: this.state.count + 1, isAutoSave: this.state.isAutoSave});
  }

  toggleAutoSave() {
    if( this.storyBuilder) {
      this.storyBuilder.storyArea.toggleIsAutoSave();
      this.setState({isAutoSave: this.storyBuilder.storyArea.isAutoSave, count: this.state.count});
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
            <AutoSaveButton
              isAutoSave={this.storyBuilder.storyArea.isAutoSave}
              clickCallback={this.toggleAutoSave}/>
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

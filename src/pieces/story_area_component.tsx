import React, {Component, ReactElement} from "react";
import {StoryArea} from "../models/story_area";
import {MomentsManager} from "../models/moments-manager";
import {Moment} from "../models/moment";
import {MomentComponent} from "./moment_component";

export class StoryAreaComponent extends Component<{ myStoryArea:StoryArea }, {count:number}> {

	private myMomentsManager:MomentsManager;

	constructor(props:any) {
		super(props);
		this.state = {count: 0};

		this.onMomentClick = this.onMomentClick.bind(this);
		this.onMomentDelete = this.onMomentDelete.bind(this);
		this.onMomentDuplicate = this.onMomentDuplicate.bind(this);
		this.refresh = this.refresh.bind(this);

		this.props.myStoryArea.setForceUpdateCallback( this.refresh);
		this.myMomentsManager = props.myStoryArea.momentsManager;
	}

	refresh() {
		this.setState({count: this.state.count + 1});
	}

	onMomentClick(moment:Moment) {
		this.myMomentsManager.handleMomentClick(moment);
		this.refresh();
	}

	onMomentDelete() {
		this.myMomentsManager.deleteCurrentMoment();
		this.refresh();
	}

	onMomentDuplicate() {
		this.myMomentsManager.duplicateCurrentMoment();
		this.refresh();
	}

	render() {
		let this_ = this;

		function momentsComponents() {
			let tComponents:ReactElement[] = [];
			this_.myMomentsManager.forEachMoment((iMoment:Moment) => {
				tComponents.push(
					<MomentComponent key={`moment-${iMoment.ID}`}
													 	myMoment={iMoment}
													  isNew={iMoment.isNew()}
														onClickCallback={this_.onMomentClick}
														onDeleteCallback={this_.onMomentDelete}
														onDuplicateCallback={this_.onMomentDuplicate}/>
				)
			});
			return tComponents;
		}

		return(
			<div className='SB-story-area'>
				{momentsComponents()}
			</div>
		);
	}
}
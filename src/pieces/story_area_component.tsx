import React, {Component, ReactElement} from "react";
import {StoryArea} from "../models/story_area";
import {MomentsManager} from "../models/moments-manager";
import {Moment} from "../models/moment";
import {MomentComponent} from "./moment_component";

export class StoryAreaComponent extends Component<{ myStoryArea:StoryArea }, {}> {

	private myMomentsManager:MomentsManager;

	constructor(props:any) {
		super(props);
		this.props.myStoryArea.setForceUpdateCallback( this.forceUpdate);
		this.myMomentsManager = props.myStoryArea.momentsManager;
	}

	onMomentClick(moment:Moment) {
		this.myMomentsManager.setCurrentMoment(moment);
	}

	render() {
		let this_ = this;

		function momentsComponents() {
			let tComponents:ReactElement[] = [];
			this_.myMomentsManager.forEachMoment((iMoment:Moment, iIndex:number) => {
				tComponents.push(
					<MomentComponent key={`moment-${iIndex}`}
													 	myMoment={iMoment}
														onClickCallback={this_.onMomentClick}/>
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
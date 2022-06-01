import React, {Component, ReactElement} from "react";
import {StoryArea} from "../models/story_area";
import {MomentsManager} from "../models/moments-manager";
import {Moment} from "../models/moment";
import {MomentComponent} from "./moment_component";
import {Dialog} from "./dialog";
import {EmptyMoment} from "./empty_moment";

export class StoryAreaComponent extends Component<{ myStoryArea: StoryArea, forceUpdateCallback:any },
	{ mode:string, count: number, dialogState:any | null }> {

	private myMomentsManager: MomentsManager;
	private placementIndicator:any;
	private dragState:{ momentOver:Moment | null, indicatorX: number | null, insertionDirection:string}

	constructor(props: any) {
		super(props);
		this.state = {mode: 'normal', count: 0, dialogState: null };

		this.onMomentClick = this.onMomentClick.bind(this);
		this.onMomentDelete = this.onMomentDelete.bind(this);
		this.onMomentDuplicate = this.onMomentDuplicate.bind(this);
		this.onTitleKeydown = this.onTitleKeydown.bind(this);
		this.refresh = this.refresh.bind(this);
		this.handleDragOver = this.handleDragOver.bind(this);
		this.setInfoOfMomentBeingDraggedOver = this.setInfoOfMomentBeingDraggedOver.bind(this);
		this.onStoryAreaPing = this.onStoryAreaPing.bind(this);
		this.handleDrop = this.handleDrop.bind(this);

		this.props.myStoryArea.setForceUpdateCallback(this.refresh);
		this.myMomentsManager = props.myStoryArea.momentsManager;
		this.placementIndicator = React.createRef();
		this.dragState = { momentOver: null, indicatorX: null, insertionDirection: ''}

		this.props.myStoryArea.setPingCallback( this.onStoryAreaPing)
	}

	refresh() {
		this.props.forceUpdateCallback();
		// this.setState({count: this.state.count + 1});
	}

	onMomentClick(moment: Moment) {
		this.props.myStoryArea.handleMomentClick(moment);
		this.refresh();
	}

	onMomentDelete() {
		this.props.myStoryArea.deleteCurrentMoment();
		this.refresh();
	}

	onMomentDuplicate() {
		this.props.myStoryArea.makeNewMoment();
		this.refresh();
	}

	onTitleKeydown() {
	}

	onStoryAreaPing( iDialogState:any) {
		if( !iDialogState || iDialogState.ping === 'normal')
			this.setState({mode: 'normal', count: this.state.count, dialogState: this.state.dialogState});
		else {
			this.setState( { mode: 'dialog', dialogState: iDialogState, count: this.state.count});
		}
	}

	handleDragOver(e:any) {
		if( e.dataTransfer.types.includes('text/plain')) {
			this.placementIndicator.current.style.left = `${this.dragState.indicatorX}px`;
			e.preventDefault();	// So that we'll get the drop event
		}
	}

	handleDrop(e:any) {
		let tIDOfMomentBeingDragged = Number(e.dataTransfer.getData('text')),
				tMomentBeingDragged = this.myMomentsManager.getMomentByID( tIDOfMomentBeingDragged),
				tMomentOver = this.dragState.momentOver,
				tDirection = this.dragState.insertionDirection,
				tInserAfterMoment:Moment | null;
		if( !(tMomentBeingDragged && tMomentOver))
			return;
		tInserAfterMoment = (tDirection === 'before') ? tMomentOver.prev : tMomentOver;
		this.myMomentsManager.moveMomentToPositionAfter( tMomentBeingDragged, tInserAfterMoment);
		this.placementIndicator.current.style.left = null;
		this.myMomentsManager.setCurrentMoment(tMomentBeingDragged);
		StoryArea.displayNarrativeAndTitleInTextBox(tMomentBeingDragged);
		this.refresh();
	}

	/**
	 *
	 * @param iMomentOver {Moment} the moment the mouse is over
	 * @param iIndicatorX {number} where the indicator should be displayed
	 * @param iInsertion {string} 'before' or 'after'
	 */
	setInfoOfMomentBeingDraggedOver(iMomentOver:Moment, iIndicatorX:number, iInsertion:string) {
		this.dragState = { momentOver: iMomentOver, indicatorX: iIndicatorX, insertionDirection: iInsertion};
	}

	render() {
		let this_ = this,
			tPlacementIndicator = (
				<div
					className='SB-placement'
					ref={this.placementIndicator}
				> </div>
			);

		function momentsComponents() {
			let tComponents: ReactElement[] = [];
			this_.myMomentsManager.forEachMoment((iMoment: Moment) => {
				tComponents.push(
					<MomentComponent key={`moment-${iMoment.ID}`}
													 myMoment={iMoment}
													 momentsAreAutoSaved={this_.props.myStoryArea.isAutoSave}
													 onClickCallback={this_.onMomentClick}
													 onTitleBlurCallback={(iMoment: Moment, iNewTitle: string) => {
														 this_.props.myStoryArea.handleNewTitle(iMoment, iNewTitle);
													 }}
													 onTitleKeydownCallback={this_.onTitleKeydown}
													 onDeleteCallback={this_.onMomentDelete}
													 onDuplicateCallback={this_.onMomentDuplicate}
													 onSaveCallback={this_.props.myStoryArea.saveCurrentMoment}
													 onRevertCallback={this_.props.myStoryArea.revertCurrentMoment}
														onDragOverCallback={this_.setInfoOfMomentBeingDraggedOver}/>
				);
			});
			if( tComponents.length === 0) {
				tComponents.push(
					<EmptyMoment
						key='empty'
						onClick ={()=>this_.onMomentDuplicate()}/>
				)
			}
			return tComponents;
		}

		function dialog(iMode:string) {
			if (iMode === 'dialog' /*&& !this_.props.myStoryArea.isAutoSave*/) {
				return (<Dialog
					dialogState={this_.state.dialogState}
				checkboxCallback={ this_.props.myStoryArea.getSetIsAutoSave}/>);
			}
			else return '';
		}

		function coverSheet( iMode:string) {
			if( iMode === 'dialog' && !this_.props.myStoryArea.isAutoSave) {
				return (
					<div className= 'SB-cover-sheet'
					onClickCapture={(e)=>{
						console.log('Click cover');
						e.preventDefault();
						e.stopPropagation();
						return false;
					}}> </div>
				);
			}
			else return '';
		}

		return (
			<div className='SB-story-area'
			onDragOver={this.handleDragOver}
			onDrop={this.handleDrop}
			>
				{momentsComponents()}
				{tPlacementIndicator}
				{coverSheet(this_.state.mode)}
				{dialog(this_.state.mode)}
			</div>
		);
	}
}
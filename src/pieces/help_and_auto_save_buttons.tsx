/**
 * This is a button in the upper right. When clicked the user gets more info about Story Builder.
 **/
import React from "react";
import tr from "../utilities/translate";

export function HelpButton() {

	return (
		<div className='SB-button'
				 style={{right: 0} }>
			<a href='https://codap.concord.org/~bfinzer/help_site/help_site.html' rel="noreferrer" target='_blank'>
			<img className= 'SB-help-default' alt={tr("DG.plugin.StoryBuilder.buttons.helpAlt")}
					 title={tr("DG.plugin.StoryBuilder.buttons.helpTitle")}
					 /></a>
		</div>
	)
}

export function AutoSaveButton(props: { isAutoSave: boolean, clickCallback: any }) {
	const state = props.isAutoSave ? 'auto' : 'non-auto',
				className = `SB-${state}-default`,
				title = props.isAutoSave ? tr("DG.plugin.StoryBuilder.buttons.autoSaveTitleAuto")
					: tr("DG.plugin.StoryBuilder.buttons.autoSaveTitleManual");
	return (
		<div className='SB-button'
				 style={{right: 0} }>
			<img className={className} alt={state}
					 onClick={props.clickCallback}
					 title={title}
					 />
		</div>
	)
}

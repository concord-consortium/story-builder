/**
 * This is a button in the upper right. When clicked the user gets more info about Story Builder.
 **/
import React from "react";

export function HelpButton() {

	return (
		<div className='SB-button'
				 style={{right: 0} }>
			<a href='https://codap.concord.org/~bfinzer/help_site/help_site.html' rel="noreferrer" target='_blank'>
			<img className= 'SB-help-default' alt='get help'
					 title='Get some help about how to use Story Builder'
					 /></a>
		</div>
	)
}

export function AutoSaveButton(props: { isAutoSave: boolean, clickCallback: any }) {
	const state = props.isAutoSave ? 'auto' : 'non-auto',
				className = `SB-${state}-default`,
				title = props.isAutoSave ? `Currently will automatically save changes to moments. Click to be asked whether to save or discard.` :
				`Currently will ask to save or discard changes to moments. Click to automatically save changes without asking.`;
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
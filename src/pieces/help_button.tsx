/**
 * This is a button in the upper right. When clicked the user gets more info about Story Builder.
 **/
import React from "react";

export function HelpButton() {

	function handleGetHelp() {
		alert("You get help!");
	}

	return (
		<div className='SB-button'
				 style={{right: 0} }>
			<img className= 'SB-help-default' alt='get help'
					 title='Get some help about how to use Story Builder'
					 onClick={( ) => handleGetHelp()}/>
		</div>
	)
}
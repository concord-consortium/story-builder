# Story Builder Plugin Project for Writing Data Stories 

### Initial steps

1. Clone this repo and `cd` into it
2. Run `npm install` to pull dependencies
3. Run `npm start` to run `webpack-dev-server` in development mode with hot module replacement

## Testing the plugin in CODAP

Currently there is no trivial way to load a plugin running on a local server 
with `http` into the online CODAP, which forces `https`. 
One simple solution is to download the latest `build_[...].zip` file from 
https://codap.concord.org/releases/zips/, extract it to a folder and run 
it locally. 
If CODAP is running on port 8080, and this project is running by default on 
3000, you can go to

http://127.0.0.1:8080/static/dg/en/cert/index.html?di=http://localhost:3000

to see the plugin running in CODAP.

This project was bootstrapped with 
[Create React App](https://github.com/facebook/create-react-app).

## Internationalization

This web application is designed to support internationalization, at least in
respect to the user visible strings. 
This section describes the processes involved in various circumstances. 
The strings file is stored locally in `src/utilities/strings.json`.
This file includes translations for all user visible strings in the web application
itself.
It does not include translations for help pages or localization of images.
It includes all translations.

The source for the translation strings is the CODAP project on the [Po Editor 
translation service](https://poeditor.com/projects/po_edit?id_language=189&id=125447).
In turn, the master for the US english strings is in the CODAP repository 
(`${CODAP}/lang/strings/en-US.json`).
**DO NOT make changes to `src/utilities/strings.json` directly.**
Instead, make the changes in the CODAP file.
The following sections describe the procedures for managing the strings file.

### I wish to add a new string to the codeline.
1. If it is not already so, clone the CODAP repository to a directory parallel to this one.
2. Add or modify the strings in `${CODAP}/lang/strings/en-US.json`. Be sure that any new strings have an ID that conforms to the naming convention for this plugin.
3. In this directory run `npm run strings:dev`. This will replace the strings file a file derived from the above edited file. It is English language only.
4. Test and verify the new strings.
5. In the CODAP root directory, push the strings to the PO Editor: `npm run strings:push`.
6. In this directory, pull the production strings file: `npm run strings:prod`. This will have all translated languages.
7. Commit and push the changed strings file.

### A translator has added or updated a CODAP translation
1. In this directory, run `npm run strings:prod`.
2. If any of the strings for this application have changed, the strings file will be updated. Test, commit and push the changes.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>
You will also see any lint errors in the console.

### `npm run build`

Builds the app for production to the `build` folder.<br>
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

See the section about 
[deployment](https://facebook.github.io/create-react-app/docs/deployment) for 
more information.


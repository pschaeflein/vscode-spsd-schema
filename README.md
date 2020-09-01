# SPFx Schema extension

Add snippets and descriptions to the JSON schema for SharePoint site script actions and `gulp serve` configurations.

## Features

### SharePoint Site Design

This extension will download the current JSON schema for SharePoint Site Design script actions and process the file to:
- correct errors in schema
- inject snippets for VSCode

The code snippets for the `verb` attribute:

![Action IntelliSense](media/readme1.gif)

The local, enhanced copy of the schema is downloaded when a site script json file is added to the workspace. A site script file is identified by matching the pattern `*.sitescript.json`

### SPFx serve configuration

This extension will download the current JSON schema for SPFx `gulp serve` configurations and process the file to:
- add missing elements to the schema
- add descriptions based on Microsoft documentation at https://docs.microsoft.com/en-us/sharepoint/dev/spfx/debug-modern-pages
- inject snippets for VSCode

## Commands

**SPFx Schema: Refresh Site Action schema**

The refresh command will download and process the official JSON schema document (https://developer.microsoft.com/json-schemas/sp/site-design-script-actions.schema.json").

**SPFx Schema: Refresh serve.json schema**

The refresh command will download and process the official JSON schema document (https://developer.microsoft.com/json-schemas/core-build/serve.schema.json").


## JSON Schema association

Files with the suffix `.sitescript.json` are associated with local, enhanced schema file ({extensionPath}/sharepoint.sitescript.json)

The file at `config\serve.json` is associated with local, enhanced schema file ({extensionPath}/serve.schema.json)

## Telemetry

This extension uses the VS Code configuration and code for recording anonymous telemetry. This can be disabled following the instructions here: https://code.visualstudio.com/docs/getstarted/telemetry
# Frontend App

This folder contains the React user interface for the variation evaluation prototype. The UI guides the user through project upload, candidate review, confirmation, evaluation, and proposal download.

## Run Locally

1. Install dependencies with `npm install`.
2. Start the development server with `npm run dev`.
3. Build the production bundle with `npm run build`.

The app usually opens on `http://127.0.0.1:5174`. If that port is already in use, Vite may choose the next available one.

## Main Screens

- **Welcome page**: introduces the workflow and points you to the current project/session.
- **Upload page**: used to upload BOQ, schedule, rate breakdown, and supporting files.
- **Chat / confirmation page**: shows extracted candidates and lets the user confirm the correct evidence before evaluation.
- **Sessions page**: lets the user revisit saved project sessions.
- **Proposal page**: shows the result, validation notes, and PDF download action.

## Workflow Summary

The frontend is not a free-form chat demo. It is a guided workflow:

1. create or continue a project session
2. upload project files
3. review extracted matches
4. confirm the source data
5. run the evaluation
6. open the proposal and download the PDF

## Tech Stack

- React 18 with Vite
- TypeScript
- Tailwind CSS
- Axios for backend requests

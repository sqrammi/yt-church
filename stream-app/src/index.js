import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { loadRuntimeConfig } from './runtimeConfig';

const root = ReactDOM.createRoot(document.getElementById('root'));
loadRuntimeConfig().then(config => {
  root.render(
    <React.StrictMode>
      <App config={config} />
    </React.StrictMode>
  );
}).catch(error => {
  console.error('Could not load application configuration', error);
  root.render(<div role="alert">Could not load application configuration: {error.message}</div>);
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

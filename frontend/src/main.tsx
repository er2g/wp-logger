import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from './store';
import App from './App';
import './styles/global.css';

const basePath = (import.meta.env.VITE_BASE_PATH || '/').replace(/\/$/, '');
const routerBase = basePath === '/' ? undefined : basePath;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter basename={routerBase}>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);

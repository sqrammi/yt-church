import { useState, useEffect } from 'react';
import './App.css';

import { Image } from 'react-bootstrap';

import Login from './Login';
import Dashboard from './Dashboard';

function App() {
  const [ password, setPassword ] = useState('');

  const common = { password, setPassword };

  if (!password)
    return <Login {...common}/>
  else return <Dashboard {...common}/>
}

export default App;

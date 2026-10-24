import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { App } from './app/App';
import { theme } from './app/theme';
import './style.css';

createRoot(document.getElementById('root')!).render(<StrictMode><MantineProvider theme={theme} forceColorScheme="light"><App /></MantineProvider></StrictMode>);

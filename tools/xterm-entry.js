/**
 * Entry for the terminal asset: the only place xterm is imported. esbuild
 * bundles this into `assets/xterm.js`, an IIFE that parks the classes on
 * `window.__PythonWorkspaceXterm` so the buildless plugin client can use them.
 */
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import css from '@xterm/xterm/css/xterm.css'

window.__PythonWorkspaceXterm = { Terminal, FitAddon, css }

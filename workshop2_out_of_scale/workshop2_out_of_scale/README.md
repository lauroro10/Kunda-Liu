# Out of Scale

**Name:** Out of Scale  
**Date:** 16 March 2026  
**Author:** Kunda Liu  

## Instructions / Operation Manual
1. Open the desktop version of the work in a browser.
2. Click **Start Audio** to enable sound.
3. On a mobile phone, open the same webpage.
4. Click **Enable Sensors** on the phone and allow motion/orientation access if prompted.
5. Shake the phone to inject energy into the shared particle system.
6. Tilt the phone to steer the particle flow.
7. On desktop, clicking or dragging also injects energy.
8. Click **Clear** to reset the screen brightness trails and return the energy level to its base state.

## Blurb
*Out of Scale* is a real-time audiovisual work using WebSockets and mobile phone sensors. Shakes, tilts, and touches from mobile devices are transmitted through the network to drive particle motion and sound on the desktop display. Inputs from multiple devices accumulate within a shared system, forming a continuously evolving field. Through changes in sound intensity and particle density, the work demonstrates how small bodily actions can be amplified and have collective effects within a networked environment.

## Files Included
- `index.html` — main page structure and UI
- `style.css` — visual styling for the interface
- `sketch.js` — p5.js sketch, socket logic, audio, and sensor interaction

## Notes for Running Locally
This front-end expects a Socket.IO server and the `/socket.io/socket.io.js` client route to be available.
If you are submitting a full reproducible project, include your backend files as well (for example `server.js`, `package.json`, and any deployment notes).

## Acknowledgements
- p5.js
- p5.sound
- Socket.IO
- Mobile motion/orientation APIs
- Ideas developed through the DCT workshop brief on collective interaction, scale, and networked systems

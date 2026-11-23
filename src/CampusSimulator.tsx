export default function CampusSimulator() {
  return <div className="simulator-card">
    <div className="simulator-topline"><span className="simulator-live">CAMPUS ROUTE PREVIEW</span><span>Illustrative map</span></div>
    <svg className="campus-simulator" viewBox="0 0 600 380" role="img" aria-label="Illustrative animated shuttle route across Landmark University">
      <defs>
        <pattern id="campusGrid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M38 0H0V38" fill="none" stroke="#d7e9dd" strokeWidth="1"/></pattern>
        <filter id="shuttleShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#064d2b" floodOpacity=".18"/></filter>
      </defs>
      <rect width="600" height="380" fill="#e7f5ec"/><rect width="600" height="380" fill="url(#campusGrid)" opacity=".75"/>
      <path d="M0 300C80 270 115 285 174 232S286 204 331 154 432 128 600 82M73 380C95 308 159 294 222 317S328 305 385 245 485 226 600 255M196 0C218 58 223 102 267 130S338 182 340 236 326 324 349 380M482 0C445 57 436 97 472 135S520 183 506 240 470 320 498 380" fill="none" stroke="#fff" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M70 300C125 284 142 267 174 232S279 200 331 154 429 128 520 104" fill="none" stroke="#b7d9c3" strokeWidth="2" strokeDasharray="5 9"/>
      <path id="simRoute" d="M70 300C125 284 142 267 174 232S279 200 331 154 429 128 520 104" fill="none" stroke="#0b8a4b" strokeWidth="5" strokeDasharray="2 10" strokeLinecap="round"/>
      <g className="sim-stop"><circle cx="70" cy="300" r="8"/><text x="85" y="294">First College Building</text></g>
      <g className="sim-stop"><circle cx="174" cy="232" r="8"/><text x="187" y="226">University Chapel</text></g>
      <g className="sim-stop"><circle cx="331" cy="154" r="8"/><text x="344" y="148">Second College Building</text></g>
      <g className="sim-stop"><circle cx="520" cy="104" r="8"/><text x="412" y="88">Engineering Building</text></g>
      <g className="sim-building" transform="translate(75 70)"><rect width="78" height="46" rx="8"/><path d="M12 14h54M12 25h54M12 36h35"/></g>
      <g className="sim-building" transform="translate(388 267)"><rect width="96" height="52" rx="8"/><path d="M13 17h70M13 29h70M13 41h43"/></g>
      <g filter="url(#shuttleShadow)"><g className="sim-shuttle"><rect x="-17" y="-11" width="34" height="22" rx="7"/><path d="M-9-6h18v7H-9z"/><circle cx="-9" cy="10" r="3"/><circle cx="9" cy="10" r="3"/><animateMotion dur="11s" repeatCount="indefinite" rotate="auto"><mpath href="#simRoute"/></animateMotion></g></g>
      <g className="sim-map-label"><rect x="395" y="324" width="164" height="34" rx="17"/><text x="411" y="345">Shuttle route preview</text></g>
    </svg>
  </div>
}

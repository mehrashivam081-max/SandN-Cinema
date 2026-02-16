import React from 'react';
import MainLanding from './view/MainLanding'; // Humne jo main switcher banaya tha usko import kiya

function App() {
  return (
    <div className="App">
      {/* Sirf MainLanding ko call karenge.
        Baaki kaam (Mobile vs Laptop check karna) MainLanding khud sambhal lega.
      */}
      <MainLanding />
    </div>
  );
}

export default App;

/* async function fetchApi() {
  try {
    const response = await fetch(
      "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/statistiques-des-documents-numerises-des-bibliotheques-patrimoniales/records?limit=20"
    );
    const apiData = await response.json();
    console.log(apiData);
    //return apiData;
  } catch (error) {
    console.log(error);
  }
}
fetchApi(); */

import './style.css';
  // Récupération des données depuis l'API
const lienApi = async() => {
try { 
const resultat = await fetch("https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/femmes-illustres-a-paris-parcours/records?limit=20"
);

   const apiData = await resultat.json();
    console.log(apiData);// Toujours visible dans la console
    //return apiData;

// Sélection de l'élément HTML où afficher les données
    const container = document.getElementById("api-container");
    // On vide le container au cas où
    container.innerHTML = "";
     // On parcourt les enregistrements et on les affiche
    apiData.records.forEach((record, index) => {
      const div = document.createElement("div");
      div.classList.add("record"); // pour styler chaque entrée
      div.innerHTML = `
        <h3>Document #${index + 1}</h3>
        <p><strong>Nom:</strong> ${record.record.fields.titre_document || "N/A"}</p>
        <p><strong>Date de numérisation:</strong> ${record.record.fields.date_num || "N/A"}</p>
      `;
      container.appendChild(div);
    });

  } catch (error) {
    console.log(error);
  }
}
 lienApi ();


//⚠️⚠️Points importants à retenir⚠️⚠️
//⚠️Pour check les erreurs dans le code :
/* const lienhApi = async () => {
  return await fetch('/api/data')
    .then(r => r.json())
    .catch(err => {
      console.error('Erreur:', err);
      return null;
    });
}; */

//⚠️async toujours avant les paramètres : async () => {}
/* await uniquement dans une fonction async
Retourne toujours une Promise, même sans return
Gestion d'erreurs avec try/catch ou .catch()
Dans React : ne pas rendre un composant async directement */


/* console.log(resizeBy)
import javascriptLogo from './javascript.svg'
import viteLogo from '/vite.svg'
import { setupCounter } from './counter.js'

document.querySelector('#app').innerHTML = `
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank">
      <img src="${javascriptLogo}" class="logo vanilla" alt="JavaScript logo" />
    </a>
    <h1>Hello Vite!</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the Vite logo to learn more
    </p>
  </div>
`

setupCounter(document.querySelector('#counter'))
 */
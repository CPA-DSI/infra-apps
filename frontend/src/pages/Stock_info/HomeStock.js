import React, { useState, useEffect } from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import StockInfo from './StockInfo.js';
import CatalogueEtEmplacements from '../CatalogueEtEmplacements/CatalogueEtEmplacements.js';
import HistoriqueArrivees from '../HistoriqueArrivees/HistoriqueArrivees.js';

const HomeStock = () => {
// Supprimez cette ligne car elle n'est pas utilisée pour le contrôle
// const [key, setKey] = useState('StockInfo'); 
  return (
    <div className="page-stock">
    <Tabs
      defaultActiveKey="StockInfo"
      id="uncontrolled-tab-example"
      className="mb-3"
    >
      <Tab eventKey="StockInfo" title="Mouvements de stock">
        <StockInfo />
      </Tab>
      <Tab eventKey="HistoriqueArrivees" title="Suivi des Entrées de Matériels">
        <HistoriqueArrivees />
      </Tab>
      <Tab eventKey="CatalogueEtEmplacements" title="Materiels">
        <CatalogueEtEmplacements />
      </Tab>
    </Tabs>
    </div>
  );
};

export default HomeStock;

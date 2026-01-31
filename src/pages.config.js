/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminSettings from './pages/AdminSettings';
import Dashboard from './pages/Dashboard';
import Financials from './pages/Financials';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import PrintLabels from './pages/PrintLabels';
import Returns from './pages/Returns';
import RunDetails from './pages/RunDetails';
import RunnerHome from './pages/RunnerHome';
import RunnerLogin from './pages/RunnerLogin';
import RunnerPickStore from './pages/RunnerPickStore';
import RunnerPicking from './pages/RunnerPicking';
import Runs from './pages/Runs';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminSettings": AdminSettings,
    "Dashboard": Dashboard,
    "Financials": Financials,
    "Inventory": Inventory,
    "Orders": Orders,
    "PrintLabels": PrintLabels,
    "Returns": Returns,
    "RunDetails": RunDetails,
    "RunnerHome": RunnerHome,
    "RunnerLogin": RunnerLogin,
    "RunnerPickStore": RunnerPickStore,
    "RunnerPicking": RunnerPicking,
    "Runs": Runs,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
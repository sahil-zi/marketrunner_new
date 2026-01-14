import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import Runs from './pages/Runs';
import RunDetails from './pages/RunDetails';
import Financials from './pages/Financials';
import AdminSettings from './pages/AdminSettings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Inventory": Inventory,
    "Orders": Orders,
    "Runs": Runs,
    "RunDetails": RunDetails,
    "Financials": Financials,
    "AdminSettings": AdminSettings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
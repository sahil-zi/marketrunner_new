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
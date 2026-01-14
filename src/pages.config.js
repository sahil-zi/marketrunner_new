import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import Runs from './pages/Runs';
import RunDetails from './pages/RunDetails';
import Financials from './pages/Financials';
import AdminSettings from './pages/AdminSettings';
import RunnerLogin from './pages/RunnerLogin';
import RunnerHome from './pages/RunnerHome';
import RunnerPickStore from './pages/RunnerPickStore';
import RunnerPicking from './pages/RunnerPicking';
import PrintLabels from './pages/PrintLabels';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Inventory": Inventory,
    "Orders": Orders,
    "Runs": Runs,
    "RunDetails": RunDetails,
    "Financials": Financials,
    "AdminSettings": AdminSettings,
    "RunnerLogin": RunnerLogin,
    "RunnerHome": RunnerHome,
    "RunnerPickStore": RunnerPickStore,
    "RunnerPicking": RunnerPicking,
    "PrintLabels": PrintLabels,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
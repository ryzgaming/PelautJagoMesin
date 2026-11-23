import {createRoot} from "react-dom/client";
import App from "./App";
import Form from "./Form";
import {alurForm} from "./paths";
import "./style.css";
createRoot(document.getElementById("root")!).render(location.pathname.replace(/\/$/, "")===alurForm?<Form/>:<App/>);

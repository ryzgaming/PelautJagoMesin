import {createRoot} from "react-dom/client";
import App from "./App";
import Form from "./Form";
import "./style.css";
createRoot(document.getElementById("root")!).render(location.pathname==="/form"?<Form/>:<App/>);

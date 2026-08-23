import { getUserGuilds } from "@/actions/guilds";
import { createElement } from "react";
import SidebarClient from "./SidebarClient";

export default async function Sidebar() {
  return getUserGuilds().then((guilds) =>
    createElement(SidebarClient, { initialGuilds: guilds }),
  );
}
import { Platform, type App, type EventRef, type WorkspaceLeaf } from "obsidian";
import { sidebarStep } from "../compose/sidebar";

/** What the follower needs from the plugin. */
export interface SidebarHost {
  /** True while the reader wants the right sidebar closed on listing pages. */
  enabled(): boolean;
  /** True when the leaf shows a Home Cards page that is not a single note's page. */
  isListingPage(leaf: WorkspaceLeaf): boolean;
  register(ref: EventRef): void;
}

/**
 * Closes the right sidebar while a Home Cards listing page is in front and
 * opens it again on the way back to a note; the rule is in compose/sidebar.ts.
 * Phones keep their sidebars as drawers the reader opens, so it does nothing there.
 */
export class SidebarFollower {
  private closedByHome = false;

  constructor(
    private readonly app: App,
    private readonly host: SidebarHost
  ) {}

  start(): void {
    if (Platform.isPhone) return;
    this.host.register(this.app.workspace.on("active-leaf-change", (leaf) => this.follow(leaf)));
    this.follow(this.app.workspace.getMostRecentLeaf());
  }

  private follow(leaf: WorkspaceLeaf | null): void {
    if (!leaf) return;
    if (!this.host.enabled()) {
      this.closedByHome = false;
      return;
    }
    const { leftSplit, rightSplit } = this.app.workspace;
    const root = leaf.getRoot();
    const next = sidebarStep(
      this.closedByHome,
      { listingPage: this.host.isListingPage(leaf), inSidebar: root === leftSplit || root === rightSplit },
      rightSplit.collapsed
    );
    this.closedByHome = next.closedByHome;
    if (next.step === "close") rightSplit.collapse();
    else if (next.step === "reopen") rightSplit.expand();
  }
}

import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";

export default function NotFoundPage() {
  return (
    <div className="content-page">
      <EmptyState
        icon="compass"
        eyebrow="404 / Off the map"
        title="That trail isn't on the map."
        description="The page you asked for does not exist in this foundation."
      >
        <Link to="/" className="text-link">
          Return to Explore <Icon name="arrow" size={16} />
        </Link>
      </EmptyState>
    </div>
  );
}

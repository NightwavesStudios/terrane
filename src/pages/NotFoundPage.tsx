import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";

export default function NotFoundPage() {
  return (
    <div className="content-page">
      <EmptyState
        icon="compass"
        eyebrow="404 / Off the map"
        title="That line of the map ends here."
        description="The page you asked for does not exist in Terrane. The globe, the atlas and your journal are all still where you left them."
      >
        <Link to="/" className="text-link">
          Return to the globe <Icon name="arrow" size={16} />
        </Link>
      </EmptyState>
    </div>
  );
}

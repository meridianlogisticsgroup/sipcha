// ...
import Login from "./pages/Login";
// ...

function Guard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  const company = localStorage.getItem("company");
  const urlCompany = new URLSearchParams(window.location.search).get("company");
  // Allow company to be set from the first login, then persisted
  if (!company && urlCompany) localStorage.setItem("company", urlCompany);
  if (!token || !(company || urlCompany)) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// ...
<Routes>
  <Route path="/login" element={<Login />} />
  <Route element={<Shell />}>
    <Route index element={<Guard><Dashboard /></Guard>} />
    <Route path="/agents" element={<Guard><Agents /></Guard>} />
    <Route path="/numbers" element={<Guard><Numbers /></Guard>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route>
</Routes>
// ...

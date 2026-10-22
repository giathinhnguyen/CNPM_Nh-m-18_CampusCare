import { useEffect, useState } from "react";

function App() {
  const [message, setMessage] = useState("Đang kết nối API...");

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

    fetch(apiUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error("API không phản hồi thành công");
        }

        return response.text();
      })
      .then(setMessage)
      .catch(() => {
        setMessage("Không thể kết nối đến API");
      });
  }, []);

  return (
    <main>
      <h1>BrewLite</h1>
      <p>Phản hồi từ API: {message}</p>
    </main>
  );
}

export default App;

import React from "react";

function TestApp() {
  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#f0f0f0",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ color: "#333", textAlign: "center" }}>
        🎥 Pillo 輪廓偵測系統 - 測試頁面
      </h1>

      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "10px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        }}
      >
        <h2>系統狀態檢查</h2>

        <div style={{ marginBottom: "20px" }}>
          <h3>前端狀態</h3>
          <p>✅ React 應用程式正常運行</p>
          <p>✅ 組件渲染成功</p>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <h3>網路連接測試</h3>
          <button
            onClick={async () => {
              try {
                const response = await fetch("http://localhost:8000/");
                if (response.ok) {
                  const data = await response.json();
                  alert("後端連接成功！\n" + JSON.stringify(data, null, 2));
                } else {
                  alert("後端連接失敗，狀態碼: " + response.status);
                }
              } catch (error) {
                alert("無法連接到後端: " + error.message);
              }
            }}
            style={{
              padding: "10px 20px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            測試後端連接
          </button>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <h3>設備檢測測試</h3>
          <p>用戶代理: {navigator.userAgent}</p>
          <p>
            設備類型:{" "}
            {/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
              navigator.userAgent
            )
              ? /iPad/i.test(navigator.userAgent)
                ? "平板"
                : "手機"
              : "電腦"}
          </p>
        </div>

        <div>
          <h3>下一步</h3>
          <p>如果後端連接測試成功，請返回主應用程式。</p>
          <p>如果連接失敗，請確保後端服務正在運行。</p>
        </div>
      </div>
    </div>
  );
}

export default TestApp;

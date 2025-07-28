document.addEventListener("DOMContentLoaded", async () => {
  const macroChartCanvas = document.getElementById("macroCircleChart");
  const weeklyTableBody = document.getElementById("weekly-macros");

  let user;

  try {
    const {
      data: { user: sessionUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !sessionUser) {
      console.error("User not logged in");
      window.location.href = "login.html";
      return;
    }
    user = sessionUser;

    const { data: goalData } = await supabase
      .from("macro_goals")
      .select("calories, protein, carbs, fat")
      .eq("user_id", user.id)
      .maybeSingle();

    const today = new Date().toISOString().split("T")[0];
    const { data: todayLogs } = await supabase
      .from("macro_log")
      .select("protein, carbs, fat")
      .eq("user_id", user.id)
      .eq("date", today);

    const totals = todayLogs.reduce(
      (acc, entry) => {
        acc.protein += entry.protein || 0;
        acc.carbs += entry.carbs || 0;
        acc.fat += entry.fat || 0;
        return acc;
      },
      { protein: 0, carbs: 0, fat: 0 }
    );

    new Chart(macroChartCanvas, {
      type: "doughnut",
      data: {
        labels: ["Carbs", "Protein", "Fat"],
        datasets: [
          {
            label: "Consumed",
            data: [totals.carbs, totals.protein, totals.fat],
            backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"],
            borderWidth: 1,
          },
        ],
      },
      options: {
        cutout: "70%",
        plugins: {
          legend: { position: "bottom" },
        },
      },
    });

    const { data: weeklyLogs } = await supabase
      .from("macro_log")
      .select("date, protein, carbs, fat")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(7);

    weeklyTableBody.innerHTML = "";
    weeklyLogs.forEach((entry) => {
      const calories =
        entry.protein * 4 + entry.carbs * 4 + entry.fat * 9;
      weeklyTableBody.innerHTML += `
        <tr>
          <td>${entry.date}</td>
          <td>${entry.carbs}</td>
          <td>${entry.protein}</td>
          <td>${entry.fat}</td>
          <td>${calories}</td>
        </tr>
      `;
    });

    // Meal Form Submission
    const mealForm = document.getElementById("meal-form");
    mealForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("meal-name").value.trim();
      const protein = parseFloat(document.getElementById("protein").value);
      const carbs = parseFloat(document.getElementById("carbs").value);
      const fat = parseFloat(document.getElementById("fat").value);
      const logStatus = document.getElementById("log-status");

      const { error } = await supabase.from("macro_log").insert([
        {
          user_id: user.id,
          date: today,
          name,
          protein,
          carbs,
          fat,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error("Failed to log meal:", error);
        logStatus.textContent = "❌ Failed to log meal.";
        logStatus.classList.add("text-danger");
      } else {
        logStatus.textContent = "✅ Meal logged!";
        logStatus.classList.remove("text-danger");
        logStatus.classList.add("text-success");
        setTimeout(() => location.reload(), 1000);
      }
    });
  } catch (err) {
    console.error("Unexpected error loading macro tracking", err);
  }
});

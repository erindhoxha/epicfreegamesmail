document
  .getElementById("subscriptionForm")
  .addEventListener("submit", async function (event) {
    event.preventDefault();
    var emailInput = document.getElementById("email");
    var message = document.getElementById("subscriptionMessage");
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.value)) {
      message.textContent = "Please enter a valid email address.";
      message.style.display = "block";
      message.style.color = "red";
    } else {
      message.style.display = "none";
      const response = await insertEmail(emailInput.value);
      emailInput.value = "";
      if (response.error?.code === "23505") {
        message.textContent = "This email address already exists.";
        message.style.display = "block";
        message.style.color = "red";
      } else if (response.error) {
        message.textContent =
          "Something went wrong on our end. Please try again.";
        message.style.display = "block";
        message.style.color = "red";
      }
    }
  });

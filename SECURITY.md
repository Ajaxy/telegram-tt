# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 5.1.x   | :white_check_mark: |
| 5.0.x   | :x:                |
| 4.0.x   | :white_check_mark: |
| < 4.0   | :x:                |

## Reporting a Vulnerability

Use this section to tell people how to report a vulnerability.

Tell them where to go, how often they can expect to get an update on a
reported vulnerability, what to expect if the vulnerability is accepted or
declined, etc.
<?php
session_start();
include '../db.php';

if (isset($_POST['login'])) {
    $username = $_POST['username'];
    $password = $_POST['password'];

    $sql = "SELECT * FROM admin_users WHERE username='$username'";
    $result = $conn->query($sql);
    if ($result->num_rows == 1) {
        $row = $result->fetch_assoc();
        if (password_verify($password, $row['password'])) {
            $_SESSION['admin'] = $username;
            header("Location: dashboard.php");
        } else {
            $error = "Şifrə səhvdir!";
        }
    } else {
        $error = "Admin tapılmadı!";
    }
}
?>

<form method="POST">
    <input type="text" name="username" placeholder="İstifadəçi adı" required>
    <input type="password" name="password" placeholder="Şifrə" required>
    <button type="submit" name="login">Giriş</button>
    <?php if(isset($error)) echo "<p>$error</p>"; ?>
</form>

<?php
// $Id$
$_SERVER['BASE_PAGE'] = 'releases/5_3_15.php';
include_once $_SERVER['DOCUMENT_ROOT'] . '/include/prepend.inc';
site_header("PHP 5.3.15 Release Announcement");
?>

<h1>PHP 5.3.15 Release Announcement</h1>

<p>The PHP development team would like to announce the immediate
availability of PHP 5.3.15. Over 30 bugs were fixed, including a security
related overflow issue in the stream implementation. All users of PHP
are encouraged to upgrade to this release.</p>

<p>For source downloads of PHP 5.3.15 please visit our <a href="http://www.php.net/downloads.php">downloads page</a>,
Windows binaries can be found on <a href="http://windows.php.net/download/">windows.php.net/download/</a>.
The list of changes is recorded in the <a href="http://www.php.net/ChangeLog-5.php#5.3.15">ChangeLog</a>.
</p>

<?php site_footer(); ?>

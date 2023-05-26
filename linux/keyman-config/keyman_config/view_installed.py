#!/usr/bin/python3

import logging
import os
import pathlib
import subprocess
import sys

import gi

gi.require_version('Gtk', '3.0')
gi.require_version('Gdk', '3.0')

from gi.overrides.GLib import GError
from gi.repository import GdkPixbuf, Gtk

from keyman_config import _
from keyman_config.accelerators import bind_accelerator, init_accel
from keyman_config.dbus_util import get_keyman_config_service
from keyman_config.downloadkeyboard import DownloadKmpWindow
from keyman_config.get_kmp import (InstallLocation, get_keyboard_dir,
                                   get_keyman_dir)
from keyman_config.install_window import InstallKmpWindow, find_keyman_image
from keyman_config.keyboard_details import KeyboardDetailsView
from keyman_config.kmpmetadata import get_fonts, parsemetadata
from keyman_config.list_installed_kmp import get_installed_kmp
from keyman_config.options import OptionsView
from keyman_config.sentry_handling import SentryErrorHandling
from keyman_config.uninstall_kmp import uninstall_kmp
from keyman_config.welcome import WelcomeView


class ViewInstalledWindowBase(Gtk.Window):
    def __init__(self):
        self.accelerators = None
        Gtk.Window.__init__(self, title=_("Keyman Configuration"))
        init_accel(self)
        self._config_service = get_keyman_config_service(self.refresh_installed_kmp)

    def refresh_installed_kmp(self):
        pass

    def on_close_clicked(self, button):
        logging.debug("Close application clicked")
        self.close()

    def on_refresh_clicked(self, button):
        logging.debug("Refresh application clicked")
        self.refresh_installed_kmp()

    def on_download_clicked(self, button):
        logging.debug("Download clicked")
        downloadDlg = DownloadKmpWindow(self)
        response = downloadDlg.run()
        if response != Gtk.ResponseType.OK:
            downloadDlg.destroy()
            return

        file = downloadDlg.downloadfile
        language = downloadDlg.language
        downloadDlg.destroy()
        self.restart(self.install_file(file, language))

    def on_installfile_clicked(self, button):
        logging.debug("Install from file clicked")
        dlg = Gtk.FileChooserDialog(
          _("Choose a kmp file..."), self, Gtk.FileChooserAction.OPEN,
          (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL, Gtk.STOCK_OPEN, Gtk.ResponseType.OK))
        dlg.resize(640, 480)
        filter_text = Gtk.FileFilter()
        # i18n: file type in file selection dialog
        filter_text.set_name(_("KMP files"))
        filter_text.add_pattern("*.kmp")
        dlg.add_filter(filter_text)
        response = dlg.run()
        if response != Gtk.ResponseType.OK:
            dlg.destroy()
            return

        file = dlg.get_filename()
        dlg.destroy()
        self.restart(self.install_file(file))

    def install_file(self, kmpfile, language=None):
        installDlg = InstallKmpWindow(kmpfile, viewkmp=self, language=language)
        if installDlg.is_error:
            return Gtk.ResponseType.CANCEL
        result = installDlg.run()
        installDlg.destroy()
        return result

    def restart(self, response=Gtk.ResponseType.OK):
        if response != Gtk.ResponseType.CANCEL:
            subprocess.Popen(sys.argv)
            self.close()

    def run(self):
        self.resize(776, 424)
        self.connect("destroy", Gtk.main_quit)
        self.show_all()
        Gtk.main()


class ViewInstalledWindow(ViewInstalledWindowBase):
    def __init__(self):
        ViewInstalledWindowBase.__init__(self)

        self.sentry = SentryErrorHandling()

        outerHbox = Gtk.HBox()
        sidebar = Gtk.StackSidebar()
        stack = Gtk.Stack()

        outerHbox.pack_start(sidebar, False, False, 0)
        outerHbox.pack_end(Gtk.Separator(), False, False, 0)
        outerHbox.pack_end(stack, True, True, 0)
        stack.set_hexpand(True)
        stack.set_vexpand(True)
        sidebar.set_stack(stack)

        stack.add_titled(self.add_keyboard_layouts_widget(), "KeyboardLayouts", _("Keyboard Layouts"))
        stack.add_titled(self.add_options_widget(), "Options", _("Options"))

        outmostVBox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        outmostVBox.pack_start(outerHbox, True, True, 0)

        bbox_bottom = Gtk.ButtonBox(spacing=12, orientation=Gtk.Orientation.HORIZONTAL)
        bbox_bottom.set_layout(Gtk.ButtonBoxStyle.START)

        button = Gtk.Button.new_with_mnemonic(_("_Install keyboard..."))
        button.set_tooltip_text(_("Install a keyboard from a file"))
        button.connect("clicked", self.on_installfile_clicked)
        bbox_bottom.add(button)

        button = Gtk.Button.new_with_mnemonic(_("_Download keyboard..."))
        button.set_tooltip_text(_("Download and install a keyboard from the Keyman website"))
        button.connect("clicked", self.on_download_clicked)
        bbox_bottom.add(button)

        button = Gtk.Button.new_with_mnemonic(_("_Refresh"))
        button.set_tooltip_text(_("Refresh keyboard list"))
        button.connect("clicked", self.on_refresh_clicked)
        bbox_bottom.add(button)

        button = Gtk.Button.new_with_mnemonic(_("_Close"))
        button.set_tooltip_text(_("Close window"))
        button.connect("clicked", self.on_close_clicked)
        bind_accelerator(self.accelerators, button, '<Control>q')
        bind_accelerator(self.accelerators, button, '<Control>w')
        bbox_bottom.add(button)

        bbox_hbox = Gtk.HBox(spacing=12)
        bbox_hbox.pack_start(bbox_bottom, True, True, 12)
        outmostVBox.pack_end(bbox_hbox, False, True, 12)
        self.add(outmostVBox)

    def add_keyboard_layouts_widget(self):
        hbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)

        scrolledWindow = Gtk.ScrolledWindow()
        hbox.pack_start(scrolledWindow, True, True, 0)

        self.store = Gtk.ListStore(
            GdkPixbuf.Pixbuf,  # icon
            str,    # name
            str,    # version
            str,    # packageID
            int,    # enum InstallLocation (KmpArea is GObject version)
            str,    # path to welcome file if it exists or None
            str)    # path to options file if it exists or None

        self.refresh_installed_kmp()

        self.tree = Gtk.TreeView(self.store)

        renderer = Gtk.CellRendererPixbuf()
        # i18n: column header in table displaying installed keyboards
        column = Gtk.TreeViewColumn(_("Icon"), renderer, pixbuf=0)
        self.tree.append_column(column)
        renderer = Gtk.CellRendererText()
        # i18n: column header in table displaying installed keyboards
        column = Gtk.TreeViewColumn(_("Name"), renderer, text=1)
        self.tree.append_column(column)
        # i18n: column header in table displaying installed keyboards
        column = Gtk.TreeViewColumn(_("Version"), renderer, text=2)
        self.tree.append_column(column)

        select = self.tree.get_selection()
        select.connect("changed", self.on_tree_selection_changed)

        scrolledWindow.add(self.tree)

        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)

        bbox_top = Gtk.ButtonBox(spacing=12, orientation=Gtk.Orientation.VERTICAL)
        bbox_top.set_layout(Gtk.ButtonBoxStyle.START)

        self.uninstall_button = Gtk.Button.new_with_mnemonic(_("_Uninstall"))
        self.uninstall_button.set_tooltip_text(_("Uninstall keyboard"))
        self.uninstall_button.connect("clicked", self.on_uninstall_clicked)
        self.uninstall_button.set_sensitive(False)
        bbox_top.add(self.uninstall_button)

        self.about_button = Gtk.Button.new_with_mnemonic(_("_About"))
        self.about_button.set_tooltip_text(_("About keyboard"))
        self.about_button.connect("clicked", self.on_about_clicked)
        self.about_button.set_sensitive(False)
        bbox_top.add(self.about_button)

        self.help_button = Gtk.Button.new_with_mnemonic(_("_Help"))
        self.help_button.set_tooltip_text(_("Help for keyboard"))
        self.help_button.connect("clicked", self.on_help_clicked)
        self.help_button.set_sensitive(False)
        bbox_top.add(self.help_button)

        self.options_button = Gtk.Button.new_with_mnemonic(_("_Options"))
        self.options_button.set_tooltip_text(_("Settings for keyboard"))
        self.options_button.connect("clicked", self.on_options_clicked)
        self.options_button.set_sensitive(False)
        bbox_top.add(self.options_button)

        vbox.pack_start(bbox_top, False, False, 12)
        hbox.pack_start(vbox, False, False, 12)

        return hbox

    def add_options_widget(self):
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        label = Gtk.Label(_("General"))
        label.set_padding(5, 5)
        label.set_halign(Gtk.Align.START)
        vbox.pack_start(label, False, False, 10)

        (enabled, reason) = self.sentry.is_sentry_enabled()
        disabledByVariable = self.sentry.is_sentry_disabled_by_variable()

        self.errorReportingButton = Gtk.CheckButton(_("Automatically report errors to keyman.com"))
        self.errorReportingButton.set_active(enabled)
        self.errorReportingButton.set_sensitive(not disabledByVariable)
        self.sentry.bind_checkbutton(self.errorReportingButton)
        vbox.pack_start(self.errorReportingButton, False, False, 0)

        if disabledByVariable:
            label = Gtk.Label(reason)
            label.set_halign(Gtk.Align.START)
            label.set_padding(25, 0)
            label.set_sensitive(False)
            vbox.pack_start(label, False, False, 0)

        return vbox

    def addlistitems(self, installed_kmp, store, install_area):
        for kmp in sorted(installed_kmp):
            kmpdata = installed_kmp[kmp]
            bmppng = ".bmp.png"  # Icon file extension

            path = get_keyboard_dir(install_area, kmpdata['packageID'])

            welcome_file = os.path.join(path, "welcome.htm")
            options_file = os.path.join(path, "options.htm")
            icofile_name = os.path.join(path, kmpdata['packageID'] + bmppng)

            if not os.path.isfile(welcome_file):
                welcome_file = None
            if not os.path.isfile(options_file):
                options_file = None
            if not os.path.isfile(icofile_name):
                icofile_name = os.path.join(path, kmpdata['keyboardID'] + bmppng)
                if not os.path.isfile(icofile_name):
                    icofile_name = find_keyman_image("icon_kmp.png")

            try:
                icofile = GdkPixbuf.Pixbuf.new_from_file_at_size(icofile_name, 16, 16)
            except GError:
                _, value, _ = sys.exc_info()
                logging.info("Error reading icon file %s: %s" % (icofile_name, value.message))
                icofile = None

            store.append([
                icofile,
                kmpdata['name'],
                kmpdata['version'],
                kmpdata['packageID'],
                install_area,
                welcome_file,
                options_file])

    def refresh_installed_kmp(self):
        logging.debug("Refreshing listview")
        self.store.clear()
        self.incomplete_kmp = []
        user_kmp = get_installed_kmp(InstallLocation.User)
        for kmp in sorted(user_kmp):
            kmpdata = user_kmp[kmp]
            if kmpdata["has_kbjson"] is False:
                self.incomplete_kmp.append(kmpdata)
        self.addlistitems(user_kmp, self.store, InstallLocation.User)
        shared_kmp = get_installed_kmp(InstallLocation.Shared)
        for kmp in sorted(shared_kmp):
            kmpdata = shared_kmp[kmp]
            if kmpdata["has_kbjson"] is False:
                self.incomplete_kmp.append(kmpdata)
        self.addlistitems(shared_kmp, self.store, InstallLocation.Shared)
        os_kmp = get_installed_kmp(InstallLocation.OS)
        for kmp in sorted(os_kmp):
            kmpdata = os_kmp[kmp]
            if kmpdata["has_kbjson"] is False:
                self.incomplete_kmp.append(kmpdata)
        self.addlistitems(os_kmp, self.store, InstallLocation.OS)

    def on_tree_selection_changed(self, selection):
        model, treeiter = selection.get_selected()
        if treeiter is not None:
            self.uninstall_button.set_tooltip_text(
                _("Uninstall keyboard {package}").format(package=model[treeiter][1]))
            self.help_button.set_tooltip_text(
                _("Help for keyboard {package}").format(package=model[treeiter][1]))
            self.about_button.set_tooltip_text(
                _("About keyboard {package}").format(package=model[treeiter][1]))
            self.options_button.set_tooltip_text(
                _("Settings for keyboard {package}").format(package=model[treeiter][1]))
            logging.debug("You selected %s version %s", model[treeiter][1], model[treeiter][2])
            self.about_button.set_sensitive(True)
            if model[treeiter][4] == InstallLocation.User:
                logging.debug("Enabling uninstall button for %s in %s", model[treeiter][3], model[treeiter][4])
                self.uninstall_button.set_sensitive(True)
            else:
                self.uninstall_button.set_sensitive(False)
                logging.debug("Disabling uninstall button for %s in %s", model[treeiter][3], model[treeiter][4])
            # welcome file if it exists
            if model[treeiter][5]:
                self.help_button.set_sensitive(True)
            else:
                self.help_button.set_sensitive(False)
            # options file if it exists
            if model[treeiter][6]:
                self.options_button.set_sensitive(True)
            else:
                self.options_button.set_sensitive(False)
        else:
            self.uninstall_button.set_tooltip_text(_("Uninstall keyboard"))
            self.help_button.set_tooltip_text(_("Help for keyboard"))
            self.about_button.set_tooltip_text(_("About keyboard"))
            self.options_button.set_tooltip_text(_("Settings for keyboard"))
            self.uninstall_button.set_sensitive(False)
            self.about_button.set_sensitive(False)
            self.help_button.set_sensitive(False)
            self.options_button.set_sensitive(False)

    def on_help_clicked(self, button):
        model, treeiter = self.tree.get_selection().get_selected()
        if treeiter is not None:
            logging.info("Open welcome.htm for %s if available", model[treeiter][1])
            welcome_file = model[treeiter][5]
            if welcome_file and os.path.isfile(welcome_file):
                uri_path = pathlib.Path(welcome_file).as_uri()
                logging.info("opening " + uri_path)
                w = WelcomeView(self, uri_path, model[treeiter][3])
                w.run()
                w.destroy()
            else:
                logging.info("welcome.htm not available")

    def on_options_clicked(self, button):
        model, treeiter = self.tree.get_selection().get_selected()
        if treeiter is not None:
            logging.info("Open options.htm for %s if available", model[treeiter][1])
            options_file = model[treeiter][6]
            if options_file and os.path.isfile(options_file):
                uri_path = pathlib.Path(options_file).as_uri()
                logging.info("opening " + uri_path)
                # TODO: Determine keyboardID
                info = {"optionurl": uri_path, "packageID": model[treeiter][3], "keyboardID": model[treeiter][3]}
                w = OptionsView(info)
                w.resize(800, 600)
                w.show_all()
            else:
                logging.info("options.htm not available")

    def on_uninstall_clicked(self, button):
        model, treeiter = self.tree.get_selection().get_selected()
        if treeiter is not None:
            logging.info("Uninstall keyboard " + model[treeiter][3] + "?")
            dialog = Gtk.MessageDialog(self, 0, Gtk.MessageType.QUESTION, Gtk.ButtonsType.YES_NO,
                                       _("Uninstall keyboard package?"))
            msg = _("Are you sure that you want to uninstall the {keyboard} keyboard?").format(
              keyboard=model[treeiter][1])
            kbdir = get_keyboard_dir(InstallLocation.User, model[treeiter][3])
            kmpjson = os.path.join(kbdir, "kmp.json")
            if os.path.isfile(kmpjson):
                info, system, options, keyboards, files = parsemetadata(kmpjson, False)
                fonts = get_fonts(files)
                if fonts:
                    # Fonts are optional
                    fontlist = ""
                    for font in fonts:
                        if 'description' in font:
                            if fontlist != "":
                                fontlist = fontlist + "\n"
                            if font['description'][:5] == "Font ":
                                fontdesc = font['description'][5:]
                            else:
                                fontdesc = font['description']
                            fontlist = fontlist + fontdesc
                    msg += "\n\n" + _("The following fonts will also be uninstalled:\n") + fontlist
            dialog.format_secondary_text(msg)
            response = dialog.run()
            dialog.destroy()
            if response == Gtk.ResponseType.YES:
                logging.info("Uninstalling keyboard" + model[treeiter][1])
                # can only uninstall with the gui from user area
                msg = uninstall_kmp(model[treeiter][3])
                if not msg == '':
                    md = Gtk.MessageDialog(self, 0, Gtk.MessageType.ERROR,
                            Gtk.ButtonsType.OK, _("Uninstalling keyboard failed.\n\nError message: ") + msg)
                    md.run()
                    md.destroy()
                logging.info("need to restart window after uninstalling a keyboard")
                self.restart()
            elif response == Gtk.ResponseType.NO:
                logging.info("Not uninstalling keyboard " + model[treeiter][1])

    def on_about_clicked(self, button):
        model, treeiter = self.tree.get_selection().get_selected()
        if treeiter is not None and model[treeiter] is not None:
            logging.info("Show keyboard details of " + model[treeiter][1])
            areapath = get_keyman_dir(model[treeiter][4])
            kmp = {
                "name": model[treeiter][1], "version": model[treeiter][2],
                "packageID": model[treeiter][3], "areapath": areapath
            }
            w = KeyboardDetailsView(self, kmp)
            w.run()
            w.destroy()


if __name__ == '__main__':
    w = ViewInstalledWindow()
    w.connect("destroy", Gtk.main_quit)
    w.resize(576, 324)
    w.show_all()
    Gtk.main()
